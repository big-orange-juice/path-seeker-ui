function decodeEvent(block) {
  const data = block.split(/\r\n|\r|\n/).filter(line => line.startsWith('data:')).map(line => line.slice(5).replace(/^ /, '')).join('\n');
  if (!data || data === '[DONE]') return null;
  let event;
  try { event = JSON.parse(data); } catch (_) { throw Error('问答数据不完整，请查看历史记录后重试'); }
  if (!event || !event.type) return null;
  if (typeof event.payload === 'string') { try { event.payload = JSON.parse(event.payload); } catch (_) { event.payload = { content: event.payload }; } }
  return event;
}
function createSSEStreamParser() {
  let buffer = '', started = false;
  const seen = new Set();
  function push(chunk, flush = false) {
    if (typeof chunk !== 'string') throw Error('问答响应格式错误');
    if (!started && chunk) { chunk = chunk.replace(/^\uFEFF/, ''); started = true; }
    buffer += chunk;
    if (buffer.length > 24 * 1024 * 1024) throw Error('问答数据过长，请重新提问');
    const events = [];
    function accept(block) {
      const event = decodeEvent(block);
      if (!event || event.eventId && seen.has(event.eventId)) return;
      if (event.eventId) seen.add(event.eventId);
      events.push(event);
    }
    let boundary;
    while ((boundary = /\r\n\r\n|\n\n|\r\r/.exec(buffer))) {
      accept(buffer.slice(0, boundary.index));
      buffer = buffer.slice(boundary.index + boundary[0].length);
    }
    if (flush) { if (buffer.trim()) accept(buffer); buffer = ''; }
    return events;
  }
  return { push: chunk => push(chunk), finish: () => push('', true), pending: () => Boolean(buffer) };
}
function parseSSE(text) {
  const parser = createSSEStreamParser();
  return parser.push(text).concat(parser.finish());
}
function createAnswer(onSentence = () => {}) {
  const answer = { content: '', sources: [], suggestions: [], locations: [], audio: [], done: false, audioError: '', error: '' };
  let hex = '', format = 'mp3', encoding = 'hex', sentence = '', size = 0;
  function finish() {
    const item = { hex, format, text: sentence.trim() };
    if (hex && !answer.audioError) { answer.audio.push({ hex, format }); onSentence(item); }
    hex = ''; sentence = '';
  }
  function accept(event) {
    if (answer.done) return;
    const payload = event.payload || {};
    switch (event.type) {
      case 'text.delta': answer.content += payload.content || ''; sentence += payload.content || ''; break;
      case 'sources': answer.sources = payload.items || []; break;
      case 'suggestions': answer.suggestions = payload.items || []; break;
      case 'exhibit.location': answer.locations = payload.items || []; break;
      case 'audio.started': format = payload.format || 'mp3'; encoding = payload.encoding || 'hex'; break;
      case 'audio.delta':
        if ((payload.encoding || encoding) !== 'hex' || payload.audio && !/^(?:[0-9a-fA-F]{2})*$/.test(payload.audio)) { answer.audioError = '音频数据格式不支持'; hex = ''; break; }
        size += (payload.audio || '').length;
        if (size > 20 * 1024 * 1024) { answer.audioError = '音频过长，请阅读文字回复'; hex = ''; break; }
        hex += payload.audio || ''; format = payload.format || format;
        if (payload.isFinal) finish();
        break;
      case 'audio.done': finish(); break;
      case 'audio.error': answer.audioError = payload.message || '语音暂不可用'; hex = ''; break;
      case 'done': answer.done = true; answer.id = payload.assistantMessageId; if (payload.sources) answer.sources = payload.sources; break;
      case 'error': answer.error = payload.message || '回答失败，请稍后重试'; break;
    }
  }
  return { answer, accept };
}
function answerFrom(events) {
  const result = createAnswer(); events.forEach(result.accept);
  if (!result.answer.done && !result.answer.error) result.answer.error = '回答中断，请查看历史记录';
  if (result.answer.audioError) result.answer.audio = [];
  return result.answer;
}
module.exports = { parseSSE, createSSEStreamParser, createAnswer, answerFrom };
