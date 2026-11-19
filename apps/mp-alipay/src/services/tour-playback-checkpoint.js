const storage = require('./storage');
const config = require('../config');
const { audibleAt } = require('./tour-audio-timeline');
const { diag } = require('./diag');
const scope = (userId, options) => JSON.stringify([userId, config.apiBase, options.roomId, options.visitId,
  options.routeId, options.guideId || '', options.language, !!options.skipExtra]);
const key = userId => storage.scoped(userId, 'tour-audio-checkpoint');
function read(userId, options) {
  const saved = storage.read(key(userId)), now = Date.now();
  if (!saved || saved.scope !== scope(userId, options) || !saved.checkpoint) return null;
  const checkpoint = saved.checkpoint, updatedAt = Date.parse(checkpoint.updatedAt);
  return Number.isFinite(updatedAt) && now - updatedAt < 86400000 && updatedAt <= now + 30000
    && typeof checkpoint.stageId === 'string' && typeof checkpoint.itemId === 'string'
    && typeof checkpoint.contentKey === 'string' && checkpoint.contentKey.length > 0
    && Number.isFinite(checkpoint.seconds) && checkpoint.seconds >= 0 ? checkpoint : null;
}
function save(owner, playback, force = false) {
  if (!owner || !owner.state || owner.state.preview || owner.reconnecting || owner.state.streamId === owner.previousStreamId) return;
  const spans = owner.state.timeline || [];
  const last = owner.state.playbackFinished && spans.filter(span => span.kind === 'route').slice(-1)[0];
  const audible = last ? Object.assign({}, last, { itemTimeSeconds: last.duration }) : audibleAt(owner.state, playback);
  if (!audible || audible.kind !== 'route' || !audible.stageId || !audible.itemId || !audible.contentKey) return;
  const now = Date.now();
  if (!force && owner.checkpointAt && now - owner.checkpointAt < 2000) return;
  const checkpoint = { stageId: audible.stageId, itemId: audible.itemId, seconds: audible.itemTimeSeconds,
    contentKey: audible.contentKey, updatedAt: new Date(now).toISOString(), finished: !!owner.state.playbackFinished };
  try {
    storage.write(key(owner.userId), { scope: scope(owner.userId, owner.options), checkpoint });
    owner.checkpointAt = now;
  } catch (error) { diag('tour-checkpoint-save', error.message); }
}
module.exports = { read, save };
