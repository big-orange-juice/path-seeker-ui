const auth = require('./auth');
const storage = require('./storage');
const config = require('../config');
const { diag } = require('./diag');
const key = userId => storage.scoped(userId, 'commentary-room');
function valid(value, userId) {
  return value && value.userId === userId && value.apiBase === config.apiBase
    && typeof value.roomId === 'string' && /^\d+$/.test(value.roomId)
    && typeof value.code === 'string' && /^\d{8}$/.test(value.code)
    && (!value.expiresAt || Date.parse(value.expiresAt) > Date.now());
}
function read() {
  const session = auth.current();
  if (!session) return null;
  const value = storage.read(key(session.userId));
  if (valid(value, session.userId)) return value;
  remove(session.userId);
  return null;
}
function write(room, language, paused, following) {
  const session = auth.current();
  if (!session || !room || room.isHost || ['closed', 'draining'].includes(room.status)) return;
  const value = { userId: session.userId, apiBase: config.apiBase, roomId: room.roomId, code: room.code,
    expiresAt: room.expiresAt || '', language, paused: !!paused, following: !!following };
  if (!valid(value, session.userId)) return;
  try { storage.write(key(session.userId), value); } catch (error) { diag('room-cache-write', error.message); }
  return value;
}
function remove(userId) {
  if (!userId) return;
  try { storage.remove(key(userId)); } catch (error) { diag('room-cache-remove', error.message); }
}
module.exports = { read, write, remove };
