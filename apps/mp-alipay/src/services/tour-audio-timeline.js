function audibleAt(state, playback, validStream = true) {
  if (!state) return null;
  if (!Array.isArray(state.timeline)) return { kind: state.roomAudioPlaying ? 'room' : state.itemId ? 'route' : 'silence',
    stageId: state.stageId, title: state.itemTitle, itemTimeSeconds: state.itemTimeSeconds, itemDurationSeconds: state.itemDurationSeconds };
  if (!validStream || !playback.live || !playback.item || playback.item.id !== state.sessionId) return null;
  const time = Number(playback.time) || 0;
  let span = state.timeline.find(value => time >= value.start && time < value.end);
  const tail = state.timeline[state.timeline.length - 1];
  if (!span && tail && time >= tail.end && time - tail.end < 3) span = tail;
  if (!span) return null;
  return { kind: span.kind, stageId: span.stageId, title: span.title, itemId: span.itemId,
    itemTimeSeconds: Math.max(0, Math.min(span.duration || 0, span.itemStart + time - span.start)), itemDurationSeconds: span.duration || 0 };
}
module.exports = { audibleAt };
