const test = require('node:test');
const assert = require('node:assert/strict');
const { harness, userId } = require('./harness.cjs');

const options = { roomId: '9223372036854775805', routeId: '9223372036854775804', visitId: '9223372036854775803', guideId: '9223372036854775802', language: 'zh', skipExtra: false };
function fixture() {
  const app = harness(), checkpoint = app.load('services/tour-playback-checkpoint');
  const owner = { userId, options, state: { sessionId: 'session', streamId: 'stream', timeline: [
    { kind: 'route', start: 0, end: 60, stageId: '9223372036854775801', itemId: 'chapter', itemStart: 0, duration: 60, contentKey: 'content-v1' },
    { kind: 'room', start: 60, end: 70, itemStart: 0, duration: 10 }
  ] } };
  const playback = { live: true, item: { id: 'session' }, time: 24 };
  return { app, checkpoint, owner, playback };
}

test('playback recovery is scoped to the account, endpoint, room, visit, route, guide, language and playlist', () => {
  const { app, checkpoint, owner, playback } = fixture();
  checkpoint.save(owner, playback, true);
  assert.equal(checkpoint.read(userId, options).seconds, 24);
  assert.equal(checkpoint.read('other-account', options), null);
  for (const field of ['roomId', 'visitId', 'routeId', 'guideId', 'language', 'skipExtra'])
    assert.equal(checkpoint.read(userId, { ...options, [field]: field === 'skipExtra' ? true : 'other' }), null, field);
  app.load('config').apiBase = 'https://other.test';
  assert.equal(checkpoint.read(userId, options), null);
});

test('room speech and obsolete stream callbacks cannot overwrite the interrupted narration checkpoint', () => {
  const { checkpoint, owner, playback } = fixture();
  checkpoint.save(owner, playback, true);
  checkpoint.save(owner, { ...playback, time: 65 }, true);
  assert.equal(checkpoint.read(userId, options).seconds, 24);
  owner.previousStreamId = owner.state.streamId;
  checkpoint.save(owner, { ...playback, time: 40 }, true);
  assert.equal(checkpoint.read(userId, options).seconds, 24);
  owner.previousStreamId = ''; owner.reconnecting = true;
  checkpoint.save(owner, { ...playback, time: 45 }, true);
  assert.equal(checkpoint.read(userId, options).seconds, 24);
  owner.reconnecting = false; owner.state.preview = true;
  checkpoint.save(owner, { ...playback, time: 50 }, true);
  assert.equal(checkpoint.read(userId, options).seconds, 24);
});

test('expired or future playback records are not restored', () => {
  const { app, checkpoint, owner, playback } = fixture();
  checkpoint.save(owner, playback, true);
  const saved = [...app.storage].find(([key]) => key.includes('tour-audio-checkpoint'))[1];
  saved.checkpoint.updatedAt = new Date(Date.now() - 86400001).toISOString();
  assert.equal(checkpoint.read(userId, options), null);
  saved.checkpoint.updatedAt = new Date(Date.now() + 60000).toISOString();
  assert.equal(checkpoint.read(userId, options), null);
});
