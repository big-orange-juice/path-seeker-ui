function parseSSE(text) {
  if (typeof text !== 'string') throw Error('问答响应格式错误');
  const events = [], seen = new Set();
  for (const block of text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split(/\n\n+/)) {
    const data = block.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).replace(/^ /, '')).join('\n');
    if (!data || data === '[DONE]') continue;
    let event;
    try { event = JSON.parse(data); } catch (_) { throw Error('问答数据不完整，请查看历史记录后重试'); }
    if (!event.type) continue;
    if (event.eventId && seen.has(event.eventId)) continue;
    if (event.eventId) seen.add(event.eventId);
    if (typeof event.payload === 'string') { try { event.payload = JSON.parse(event.payload); } catch (_) { event.payload = { content: event.payload }; } }
    events.push(event);
  }
  return events;
}
function answerFrom(events) {
  const answer = { content: '', sources: [], suggestions: [], locations: [], audio: [], done: false, audioError: '', error: '' };
  let hex = '', format = 'mp3', encoding = 'hex';
  const finish = () => { if (hex) answer.audio.push({ hex, format }); hex = ''; };
  for (const event of events) {
    const p = event.payload || {};
    switch (event.type) {
      case 'text.delta': answer.content += p.content || ''; break;
      case 'sources': answer.sources = p.items || []; break;
      case 'suggestions': answer.suggestions = p.items || []; break;
      case 'exhibit.location': answer.locations = p.items || []; break;
      case 'audio.started': format = p.format || 'mp3'; encoding = p.encoding || 'hex'; break;
      case 'audio.delta':
        if ((p.encoding || encoding) !== 'hex' || p.audio && !/^(?:[0-9a-fA-F]{2})*$/.test(p.audio)) { answer.audioError = '音频数据格式不支持'; break; }
        hex += p.audio || ''; format = p.format || format;
        if (hex.length > 20 * 1024 * 1024) { hex = ''; answer.audioError = '音频过长，请阅读文字回复'; }
        // isFinal 是一句话的边界，空的最终块也必须封口。
        if (p.isFinal) finish();
        break;
      case 'audio.done': finish(); break;
      case 'audio.error': answer.audioError = p.message || '语音暂不可用'; hex = ''; break;
      case 'done': answer.done = true; answer.id = p.assistantMessageId; if (p.sources) answer.sources = p.sources; break;
      case 'error': answer.error = p.message || '回答失败，请稍后重试'; break;
    }
  }
  if (!answer.done && !answer.error) answer.error = '回答中断，请查看历史记录';
  if (answer.audioError) answer.audio = [];
  return answer;
}
module.exports = { parseSSE, answerFrom };
