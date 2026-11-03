function progressUpdate(previous, state, now, interval = 300) {
  const signature = [state.generation, state.index, state.item && state.item.id, state.item && state.item.title,
    state.playing, state.requested, state.failed, state.duration > 0].join('|');
  const changed = !previous || previous.signature !== signature || now < previous.at
    || state.time < previous.time || Math.abs(state.time - previous.time) > 1.5;
  if (!changed && now - previous.at < interval) return null;
  return { signature, at: now, time: state.time };
}
module.exports = { progressUpdate };
