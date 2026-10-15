const http = require('./http');
const audio = require('./audio');
const speech = require('./speech');
const { createSSEStreamParser, parseSSE, createAnswer } = require('../core/sse');
function sendChat(body, hooks) {
  let cancelled = false, task, writes = Promise.resolve(), sentenceIndex = 0, muted = false;
  const received = [], paths = [], sentences = [];
  const parser = createSSEStreamParser();
  const active = () => !cancelled && hooks.active();
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
  }
  const promise = (async () => {
    try {
      task = http.post('/ExhibitChat/send-with-audio', body, {
        dataType: 'text', headers: { Accept: 'text/event-stream' }, timeout: 120000,
        onChunk: chunk => {
          if (!active()) return;
          const events = parser.push(chunk);
          received.push(...events); accept(events, true);
        }
      });
      const response = await task;
      if (!active()) return null;
      if (typeof response === 'string' && response.trim()) {
        const complete = parseSSE(response);
        if (received.some((event, index) => JSON.stringify(event) !== JSON.stringify(complete[index]))) throw Error('问答分块与完整响应不一致，请查看历史');
        accept(complete.slice(received.length), false);
      } else accept(parser.finish(), false);
      if (!accumulator.answer.done && !accumulator.answer.error) throw Error('回答中断，请查看历史记录');
      await writes;
      if (!active()) return null;
      if (body.enableAudio && !muted) audio.finishStream(token);
      return { answer: accumulator.answer, paths, sentences };
    } catch (error) {
      stopAudio(); cancelled = true;
      throw error;
    }
  })();
  promise.abort = () => { cancelled = true; if (task) task.abort(); stopAudio(); };
  promise.mute = () => { muted = true; stopAudio(); };
  return promise;
}
module.exports = { sendChat };
