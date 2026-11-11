const test = require('node:test');
const assert = require('node:assert/strict');
const { harness, tick, session } = require('./harness.cjs');
const sessionId = 'abcdef0123456789abcdef0123456789';
const mediaToken = 'A'.repeat(64), controlToken = 'B'.repeat(64);
const created = () => ({ sessionId, mediaPath: '/AudioContinuityProbe/sessions/' + sessionId + '/media.mp3?ticket=' + mediaToken, controlFragment: sessionId + ':' + controlToken, state: { sessionId, status: 'ready', events: [] } });
function setup() {
  const fixture = harness();
  const manager = fixture.my.createInnerAudioContext();
  delete manager.destroy;
  let source = '', assignments = 0;
  Object.defineProperty(manager, 'src', { get: () => source, set(value) { source = value; assignments++; manager.play(); } });
  fixture.my.getBackgroundAudioManager = () => manager;
  fixture.my.setClipboard = options => { fixture.clipboard = options.text; };
  const page = fixture.page('audio-probe'); page.onLoad(); page.onShow();
  return { fixture, page, manager, assignments: () => assignments };
}
async function creating(context, modeIndex = 0) {
  context.page.setData({ modeIndex });
  const pending = context.page.start();
  await tick();
  context.fixture.requests.find(request => request.options.url.endsWith('/capabilities')).ok({ enabled: true });
  await tick();
  return { pending, request: context.fixture.requests.find(request => request.options.url.endsWith('/sessions')) };
}
async function started(context, modeIndex = 0) {
  const operation = await creating(context, modeIndex);
  operation.request.ok(created());
  await operation.pending;
}
function cleanup(context) { context.page.onUnload(); }

test('probe assigns one native media source and keeps it across hide/show without resuming native pause', async () => {
  const context = setup();
  try {
    await started(context);
    assert.equal(context.page.data.error, '');
    assert.equal(context.page.data.active, true);
    assert.equal(context.assignments(), 1);
    context.page.onHide();
    assert.equal(context.manager.stopped, false);
    const hidden = context.fixture.requests.find(request => request.options.data && request.options.data.event === 'hide');
    assert.equal(hidden.options.data.foreground, false);
    context.manager.emit('Pause');
    context.page.onShow();
    assert.equal(context.assignments(), 1);
    assert.equal(context.page.data.playing, false);
    assert.equal(context.fixture.load('services/audio').snapshot().nativePaused, true);
  } finally { cleanup(context); }
});

test('native continuous end records failure and does not assign another source', async () => {
  const context = setup();
  try {
    await started(context);
    context.manager.emit('Ended');
    assert.match(context.page.data.error, /不会自动重连/);
    assert.equal(context.page._timer, null);
    assert.equal(context.assignments(), 1);
    assert.ok(context.fixture.requests.some(request => request.options.data && request.options.data.event === 'error'));
  } finally { cleanup(context); }
});

test('finite comparison completes normally with the native background singleton', async () => {
  const context = setup();
  try {
    await started(context, 2);
    context.manager.emit('Ended');
    assert.equal(context.page.data.error, '');
    assert.match(context.page.data.notice, /有限文件播放结束/);
    assert.equal(context.assignments(), 1);
    assert.equal(context.page._timer, null);
    assert.ok(context.fixture.requests.some(request => request.options.data && request.options.data.event === 'ended'));
  } finally { cleanup(context); }
});

test('late creation after cancel, hiding, unloading, or account switch is revoked without playing', async () => {
  for (const action of ['stop', 'onHide', 'onUnload', 'logout']) {
    const context = setup();
    try {
      const operation = await creating(context);
      if (action === 'logout') context.fixture.auth.logout(); else context.page[action]();
      operation.request.ok(created());
      await operation.pending;
      assert.equal(context.assignments(), 0, action);
      const deletion = context.fixture.requests.find(request => request.options.method === 'DELETE');
      assert.ok(deletion, action);
      assert.equal(deletion.options.headers['X-Probe-Control'], controlToken);
      assert.equal(deletion.options.headers.Authorization, undefined);
    } finally { cleanup(context); }
  }
});

test('logout stops active playback and cancels diagnostic timers', async () => {
  const context = setup();
  try {
    await started(context);
    context.fixture.auth.logout();
    assert.equal(context.manager.stopped, true);
    assert.equal(context.page.data.active, false);
    assert.equal(context.page._timer, null);
    assert.ok(context.fixture.requests.some(request => request.options.method === 'DELETE'));
  } finally { cleanup(context); }
});

test('control link has fragment credentials while exported diagnostics contain no tokens', async () => {
  const context = setup();
  try {
    await started(context);
    context.page.copyControl();
    assert.match(context.fixture.clipboard, new RegExp('/control#' + sessionId + ':' + controlToken + '$'));
    context.page.copyReport();
    assert.equal(JSON.parse(context.fixture.clipboard).sessionId, sessionId);
    assert.ok(!context.fixture.clipboard.includes(mediaToken));
    assert.ok(!context.fixture.clipboard.includes(controlToken));
    assert.ok(!context.fixture.clipboard.includes('accessToken'));
  } finally { cleanup(context); }
});

test('missing native API, non-HTTPS configuration, or active audio prevents session creation', async () => {
  for (const mode of ['missing', 'http', 'occupied', 'disabled']) {
    const context = setup();
    try {
      if (mode === 'missing') delete context.fixture.my.getBackgroundAudioManager;
      if (mode === 'http') context.fixture.load('config').apiBase = 'http://test/api';
      if (mode === 'disabled') context.fixture.load('config').audioContinuityProbe = false;
      if (mode === 'occupied') context.fixture.load('services/audio').playQueue('tour', [{ id: 'active', url: 'https://test/active.mp3' }]);
      await context.page.start();
      assert.ok(context.page.data.error, mode);
      assert.equal(context.fixture.requests.length, 0, mode);
    } finally { context.fixture.load('services/audio').stop(); cleanup(context); }
  }
});

test('disabled backend is reported before any media session is created', async () => {
  const context = setup();
  try {
    const pending = context.page.start(); await tick();
    context.fixture.requests[0].ok({ enabled: false }); await pending;
    assert.match(context.page.data.error, /尚未开启/);
    assert.equal(context.assignments(), 0);
    assert.equal(context.fixture.requests.length, 1);
  } finally { cleanup(context); }
});

test('late failure from a cancelled creation cannot overwrite the new run', async () => {
  const context = setup();
  try {
    const previous = await creating(context);
    context.page.stop();
    const next = context.page.start(); await tick();
    context.fixture.requests.filter(request => request.options.url.endsWith('/capabilities')).at(-1).ok({ enabled: true });
    await tick();
    context.fixture.requests.filter(request => request.options.url.endsWith('/sessions')).at(-1).ok(created());
    await next;
    previous.request.reject({ errorMessage: 'old network failure' });
    await previous.pending;
    assert.equal(context.page.data.error, '');
    assert.equal(context.page.data.active, true);
    assert.equal(context.assignments(), 1);
  } finally { cleanup(context); }
});

test('completed previous tour does not block a new probe, but an occupied room does', async () => {
  const context = setup();
  try {
    const audio = context.fixture.load('services/audio');
    audio.playQueue('tour', [{ id: 'done', url: 'https://media.test/done.mp3' }]);
    context.manager.emit('Ended');
    assert.equal(audio.snapshot().item, null);
    await started(context);
    assert.equal(context.page.data.error, '');
  } finally { cleanup(context); }
  const occupied = setup();
  try {
    occupied.fixture.load('services/translation-session').snapshot = () => ({ room: { roomId: '9223372036854775806' } });
    await occupied.page.start();
    assert.match(occupied.page.data.error, /退出讲解房间/);
    assert.equal(occupied.fixture.requests.length, 0);
  } finally { cleanup(occupied); }
});

test('a failed cleanup from an earlier run cannot overwrite the next run', async () => {
  const context = setup();
  try {
    await started(context);
    const stop = context.page.stop();
    const deletion = context.fixture.requests.find(request => request.options.method === 'DELETE');
    const next = context.page.start(); await tick();
    context.fixture.requests.filter(request => request.options.url.endsWith('/capabilities')).at(-1).ok({ enabled: true });
    await tick();
    const nextCreated = created();
    nextCreated.sessionId = '1234567890abcdef1234567890abcdef';
    nextCreated.mediaPath = nextCreated.mediaPath.replace(sessionId, nextCreated.sessionId);
    nextCreated.controlFragment = nextCreated.controlFragment.replace(sessionId, nextCreated.sessionId);
    nextCreated.state.sessionId = nextCreated.sessionId;
    context.fixture.requests.filter(request => request.options.url.endsWith('/sessions')).at(-1).ok(nextCreated);
    await next;
    deletion.reject({ errorMessage: 'old cleanup failed' }); await stop;
    assert.equal(context.page.data.error, '');
    assert.equal(context.page.data.active, true);
    assert.equal(context.page.data.sessionId, nextCreated.sessionId);
  } finally { cleanup(context); }
});

test('pending diagnostic heartbeat cannot accumulate requests or change the media source', async () => {
  const context = setup();
  try {
    await started(context);
    const requestsBefore = context.fixture.requests.length;
    for (let index = 0; index < 200; index++) context.page.heartbeat('heartbeat');
    assert.equal(context.fixture.requests.length, requestsBefore);
    assert.equal(context.assignments(), 1);
    context.fixture.requests.filter(request => request.options.url.endsWith('/heartbeat')).at(-1).reject({ errorMessage: 'network offline' });
    await tick();
    context.page.heartbeat('heartbeat');
    assert.equal(context.fixture.requests.length, requestsBefore + 1);
    assert.equal(context.page.data.error, '');
    assert.equal(context.assignments(), 1);
  } finally { cleanup(context); }
});

test('app hide and page unload preserve then release probe audio without stopping a later tour', async () => {
  const context = setup();
  try {
    context.fixture.load('app');
    await started(context);
    context.fixture.app.onHide(); context.page.onHide();
    assert.equal(context.manager.stopped, false);
    assert.equal(context.assignments(), 1);
    context.page.onUnload();
    assert.equal(context.manager.stopped, true);
    assert.equal(context.page._timer, null);
    assert.equal(context.manager.callbacks('Ended').length, 0);
    const audio = context.fixture.load('services/audio');
    audio.playQueue('tour', [{ id: 'next-tour', url: 'https://media.test/next-tour.mp3' }]);
    context.page.stop();
    assert.equal(audio.snapshot().owner, 'tour');
    assert.equal(audio.snapshot().playing, true);
    audio.stop();
  } finally { cleanup(context); }
});

test('native playback error does not reconnect and normal tour can play after ending the probe', async () => {
  const context = setup();
  try {
    await started(context);
    const delayedEnd = context.manager.callbacks('Ended')[0];
    context.manager.emit('Error', { errorMessage: 'network lost' });
    assert.equal(context.assignments(), 1);
    assert.equal(context.page._timer, null);
    assert.match(context.page.data.error, /不会自动重连/);
    context.page.stop();
    const audio = context.fixture.load('services/audio');
    audio.playQueue('tour', [{ id: 'next-tour', url: 'https://media.test/next-tour.mp3' }]);
    delayedEnd();
    assert.equal(audio.snapshot().item.id, 'next-tour');
    assert.equal(audio.snapshot().playing, true);
    assert.equal(audio.snapshot().failed, false);
    audio.stop();
  } finally { cleanup(context); }
});

test('creation uses the refreshed token after capabilities refreshes expired credentials', async () => {
  const context = setup();
  try {
    const pending = context.page.start(); await tick();
    context.fixture.requests[0].reject({ status: 401 }); await tick();
    context.fixture.requests.find(request => request.options.url.endsWith('/AppUser/RefreshToken')).ok(session(undefined, 'refreshed-access'));
    await tick();
    context.fixture.requests.filter(request => request.options.url.endsWith('/capabilities')).at(-1).ok({ enabled: true });
    await tick();
    const creation = context.fixture.requests.find(request => request.options.url.endsWith('/sessions'));
    assert.equal(creation.options.headers.Authorization, 'Bearer refreshed-access');
    creation.ok(created()); await pending;
    assert.equal(context.page.data.error, '');
    assert.equal(context.page.data.active, true);
  } finally { cleanup(context); }
});

test('failure to stop the current run remains visible while local audio is released', async () => {
  const context = setup();
  try {
    await started(context);
    const pending = context.page.stop();
    context.fixture.requests.find(request => request.options.method === 'DELETE').reject({ errorMessage: 'offline' });
    await pending;
    assert.equal(context.page.data.active, false);
    assert.equal(context.manager.stopped, true);
    assert.match(context.page.data.error, /停止请求未送达/);
  } finally { cleanup(context); }
});
