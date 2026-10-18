const http = require('./http');
const audio = require('./audio');
const speech = require('./speech');
const { diag } = require('./diag');
const { createSSEStreamParser, parseSSE, createAnswer } = require('../core/sse');
function sendChat(body, hooks) {
  let cancelled = false, task, writes = Promise.resolve(), sentenceIndex = 0, muted = false;
  const received = [], paths = [], sentences = [];
  const parser = createSSEStreamParser();
  const active = () => !cancelled && hooks.active();
  let wake = () => {};
  const ended = new Promise(resolve => { wake = resolve; });
  let lastEventAt = Date.now();
  function waitForEnd() {
    return new Promise(resolve => {
      const startedAt = Date.now();
      let timer = null, finished = false;
      const finish = result => { if (finished) return; finished = true; if (timer) clearTimeout(timer); resolve(result); };
      const check = () => {
        if (accumulator.answer.done || accumulator.answer.error) { finish('ended'); return; }
        // 分块模式下 30 秒没有任何数据、整轮超过 120 秒都视为中断，避免空等。
        if (Date.now() - lastEventAt > 30000 || Date.now() - startedAt > 120000) { finish('timeout'); return; }
        timer = setTimeout(check, 500);
      };
      timer = setTimeout(check, 500);
      ended.then(() => finish('ended'));
    });
  }
  const token = body.enableAudio ? audio.beginStream('chat', {
    change: state => { if (active() && hooks.playback) hooks.playback(state); },
    error: error => { muted = true; stopAudio(); if (active()) hooks.audioError(error); },
    finished: () => { if (active() && hooks.settled) hooks.settled(); }
  }) : null;
  function stopAudio() { if (token !== null && audio.snapshot().generation === token) audio.stop('chat'); }
  const accumulator = createAnswer(sentence => {
    const index = sentenceIndex++;
    writes = writes.then(async () => {
      if (!active() || muted || !body.enableAudio) return;
      const files = await speech.audioFiles([sentence], body.clientMessageId + '-' + index);
      if (!active()) { speech.cleanup(files); return; }
      paths.push(files[0]); sentences.push(sentence.text);
      hooks.files(files[0], sentence.text);
      if (!muted) audio.appendStream(token, { id: body.clientMessageId + '-' + index, url: files[0], text: sentence.text, kind: 'answer' });
    }).catch(error => { muted = true; stopAudio(); if (active()) hooks.audioError(error); });
  });
  function accept(events, streaming) {
    if (!active()) return;
    events.forEach(accumulator.accept);
    const answer = accumulator.answer;
    if (answer.audioError || answer.error) { muted = true; stopAudio(); }
    hooks.update(answer, streaming);
    if (answer.done || answer.error) wake();
  }
  const promise = (async () => {
    try {
      diag('chat-send', { audio: !!body.enableAudio, sessionId: body.sessionId, message: String(body.message || '').slice(0, 24) });
      task = http.post('/ExhibitChat/send-with-audio', body, {
        dataType: 'text', headers: { Accept: 'text/event-stream' }, timeout: 120000,
        onChunk: chunk => {
          if (!active()) return;
          lastEventAt = Date.now();
          const events = parser.push(chunk);
          received.push(...events); accept(events, true);
        }
      });
      const response = await task;
      if (!active()) return null;
      const streaming = !!(task.streamOpen && task.streamOpen());
      diag('chat-response', { type: typeof response, streaming, received: received.length });
      if (typeof response === 'string' && response.trim()) {
        const complete = parseSSE(response);
        diag('chat-buffer', { length: response.length, parsed: complete.length, received: received.length });
        if (received.some((event, index) => JSON.stringify(event) !== JSON.stringify(complete[index]))) throw Error('问答分块与完整响应不一致，请查看历史');
        accept(complete.slice(received.length), false);
      } else if (streaming) {
        // 分块模式下 success 可能只代表响应头到达；body 继续从 chunk 回调流入，以 done 事件作为整轮结束。
        diag('chat-wait', { received: received.length });
        const result = await waitForEnd();
        if (!active()) return null;
        if (result === 'timeout') { diag('chat-timeout', { received: received.length }); if (task.abort) task.abort(); throw Error('回答中断，请查看历史记录'); }
        if (task.finishStream) task.finishStream();
        accept(parser.finish(), false);
      } else { diag('chat-buffer', { empty: true, type: typeof response }); accept(parser.finish(), false); }
      if (!accumulator.answer.done && !accumulator.answer.error) {
        diag('chat-end', { received: received.length, done: false, content: accumulator.answer.content.length, audio: accumulator.answer.audio.length });
        throw Error('回答中断，请查看历史记录');
      }
      await writes;
      if (!active()) return null;
      if (body.enableAudio && !muted) audio.finishStream(token);
      return { answer: accumulator.answer, paths, sentences };
    } catch (error) {
      diag('chat-fail', { message: error.message, received: received.length, content: accumulator.answer.content.length });
      stopAudio(); cancelled = true;
      throw error;
    }
  })();
  promise.abort = () => { cancelled = true; wake(); if (task) task.abort(); stopAudio(); };
  promise.mute = () => { muted = true; stopAudio(); };
  return promise;
}
module.exports = { sendChat };
