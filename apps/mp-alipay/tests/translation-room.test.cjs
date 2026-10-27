const test = require('node:test');
const assert = require('node:assert/strict');
const { wavPcm, base64 } = require('../dist/core/room-pcm');
const { RoomEventCursor } = require('../dist/shared/translation-room');
const { harness, tick } = require('./harness.cjs');

test('driver permission shows the host controls and room creation has no vehicle binding', async () => {
  const fixture = harness();
  const page = fixture.page('translation-room');
  page.onLoad();
  await tick();
  assert.match(fixture.requests[0].options.url, /TranslationRooms\/host-permission$/);
  fixture.requests[0].ok({ canHost: true });
  await tick();
  assert.equal(page.data.canHost, true);
  let attached;
  page.attach = room => { attached = room; };
  page.create();
  await tick();
  const creation = fixture.requests[1];
  assert.deepEqual(JSON.parse(JSON.stringify(creation.options.data)), { sourceLanguage: 'zh-CN' });
  creation.ok({ roomId: '9223372036854775806', isHost: true });
  await tick();
  assert.equal(attached.roomId, '9223372036854775806');
});

test('ordinary users cannot create a host room from the page', async () => {
  const fixture = harness();
  const page = fixture.page('translation-room');
  page._visible = true;
  page.create();
  await tick();
  assert.equal(fixture.requests.length, 0);
  assert.match(page.data.error, /未获车夫授权/);
});

function wav(sampleRate = 16000) {
  const bytes = new ArrayBuffer(52), view = new DataView(bytes);
  const text = (offset, value) => { [...value].forEach((character, index) => view.setUint8(offset + index, character.charCodeAt(0))); };
  text(0, 'RIFF'); view.setUint32(4, 44, true); text(8, 'WAVE'); text(12, 'fmt '); view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, sampleRate, true); view.setUint16(34, 16, true);
  text(36, 'data'); view.setUint32(40, 8, true); view.setInt16(44, -32768, true); view.setInt16(46, 32767, true);
  return bytes;
}
test('native WAV extraction preserves signed PCM and base64 used by Alipay sockets', () => {
  const source = wav(), pcm = wavPcm(source);
  assert.equal(new DataView(pcm).getInt16(0, true), -32768);
  assert.equal(new DataView(pcm).getInt16(2, true), 32767);
  assert.equal(base64(pcm), Buffer.from(pcm).toString('base64'));
  assert.throws(() => wavPcm(wav(44100)), /16 kHz/);
  assert.throws(() => wavPcm(source.slice(0, 48)), /不完整/);
});
test('Alipay joins from the next complete segment and excludes stale subscription audio', () => {
  const cursor = new RoomEventCursor();
  cursor.accept({ type: 'subscription.ready', targetLanguage: 'en', subscriptionVersion: 4, payload: { startSequence: 11 } });
  assert.equal(cursor.accept({ type: 'audio.delta', targetLanguage: 'en', subscriptionVersion: 4, sequence: 10 }), false);
  assert.equal(cursor.accept({ type: 'audio.delta', targetLanguage: 'ja', subscriptionVersion: 3, sequence: 12 }), false);
  assert.equal(cursor.accept({ type: 'audio.delta', targetLanguage: 'en', subscriptionVersion: 4, sequence: 11 }), true);
});

function socketHarness() {
  const fixture = harness(), handlers = {}, sent = [];
  for (const name of ['Open', 'Message', 'Close', 'Error']) {
    fixture.my['onSocket' + name] = callback => { handlers[name] = callback; };
    fixture.my['offSocket' + name] = callback => { if (handlers[name] === callback) delete handlers[name]; };
  }
  fixture.my.connectSocket = options => { fixture.socketOptions = options; };
  fixture.my.sendSocketMessage = options => { sent.push(options); options.success({}); };
  fixture.my.closeSocket = () => {};
  fixture.my.getFileSystemManager = () => ({
    readFile(options) { options.success({ data: wav() }); },
    writeFile(options) { fixture.writes.push(options); options.success({}); },
    unlink(options) { fixture.removed.push(options.filePath); options.success({}); }
  });
  return { fixture, handlers, sent, service: fixture.load('services/translation-room') };
}

test('Alipay preserves final Chinese source when translation start is missing or arrives empty', async () => {
  const { fixture, handlers } = socketHarness();
  const session = fixture.load('services/translation-session');
  try {
    session.attach({ roomId: '42', isHost: true }); handlers.Open();
    const emit = event => handlers.Message({ data: JSON.stringify(event) });
    const base = { epochId: 'epoch', sequence: 1 };
    emit({ ...base, type: 'transcript.final', payload: { text: '这里是银锭桥。' } });
    emit({ ...base, type: 'translation.final', targetLanguage: 'en', payload: { text: 'This is Yinding Bridge.' } });
    emit({ ...base, type: 'translation.committed', targetLanguage: 'en', payload: { text: '' } });
    assert.equal(session.snapshot().feed[0].source, '这里是银锭桥。');
    assert.equal(session.snapshot().feed[0].text, 'This is Yinding Bridge.');
    emit({ ...base, sequence: 2, type: 'text.delta', targetLanguage: 'ja', payload: { content: '次の橋です。' } });
    emit({ ...base, sequence: 2, type: 'transcript.final', payload: { text: '这是下一座桥。' } });
    assert.equal(session.snapshot().feed[1].source, '这是下一座桥。');
  } finally { await session.leave(); }
});

test('empty completed translation becomes unavailable and the next segment still completes', async () => {
  const { fixture, handlers } = socketHarness();
  const session = fixture.load('services/translation-session');
  const page = fixture.page('translation-room');
  page._visible = true;
  page.bindSession();
  try {
    session.attach({ roomId: '42', isHost: true }); handlers.Open();
    const emit = event => handlers.Message({ data: JSON.stringify(event) });
    const base = { epochId: 'epoch', targetLanguage: 'en', sequence: 1 };
    emit({ ...base, type: 'translation.committed', payload: { text: '让我们来看一看银锭桥。' } });
    assert.equal(page.data.feed[0].status, 'translating');
    emit({ ...base, type: 'translation.final', payload: { text: '' } });
    assert.equal(page.data.feed[0].status, 'error');
    assert.match(page.data.feed[0].text, /未生成译文/);
    emit({ ...base, sequence: 2, type: 'translation.final', payload: { text: 'Let us look at Yinding Bridge.' } });
    assert.equal(page.data.feed[0].status, 'complete');
    assert.equal(page.data.feed[0].text, 'Let us look at Yinding Bridge.');
    assert.equal(page.data.feed[1].status, 'error');
    assert.deepEqual(Array.from(page.data.chatGroups, group => group.sequence), [1, 2]);
    assert.equal(page.data.chatGroups[0].source, '让我们来看一看银锭桥。');
    assert.equal(page.data.chatGroups[1].translations[0].avatar, 'EN');
    page.openDetails();
    assert.equal(page.data.detailsOpen, true);
    page.closeDetails();
    assert.equal(page.data.detailsOpen, false);
    page._chatHeight = 500;
    page.onChatScroll({ detail: { scrollHeight: 1500, scrollTop: 200 } });
    assert.equal(page.data.showLatest, true);
    page.followLatest();
    assert.equal(page.data.showLatest, false);
    assert.match(page.data.scrollTarget, /^chat-end-/);
  } finally { page.onUnload(); await session.leave(); }
});

test('Alipay normal room end preserves queued playback and immediate close stops it', async () => {
  for (const mode of ['normal', 'immediate']) {
    const { fixture, handlers, service } = socketHarness(), errors = [];
    const connection = service.connect({ roomId: '9223372036854775805', isHost: false }, { event() {}, error: error => errors.push(error), disconnected() {} });
    try {
      handlers.Open();
      assert.match(fixture.socketOptions.url, /9223372036854775805\/events$/);
      assert.equal(fixture.socketOptions.protocols[1], 'bearer.access');
      const emit = event => handlers.Message({ data: JSON.stringify(event) });
      emit({ type: 'subscription.ready', targetLanguage: 'en', subscriptionVersion: 2, payload: { startSequence: 11 } });
      emit({ type: 'audio.delta', targetLanguage: 'en', subscriptionVersion: 2, sequence: 10, payload: { audio: 'ffff', isFinal: true } });
      emit({ type: 'audio.delta', targetLanguage: 'en', subscriptionVersion: 2, sequence: 11, payload: { audio: 'aabb', isFinal: true } });
      await tick();
      assert.equal(fixture.writes.length, 1);
      assert.equal(fixture.audioContexts.length, 1);
      emit({ type: 'room.closed', subscriptionVersion: 2, payload: { mode } });
      await tick();
      assert.equal(fixture.audioContexts[0].stopped, mode === 'immediate');
      assert.equal(errors.length, 0);
      connection.close(true);
      assert.equal(fixture.audioContexts[0].stopped, true);
    } finally { connection.close(true); }
  }
});

test('Alipay host shares one socket, uploads PCM in order and releases mic after delayed start', async () => {
  const { fixture, handlers, sent, service } = socketHarness(), errors = [];
  const connection = service.connect({ roomId: '42', isHost: true }, { event() {}, error: error => errors.push(error), disconnected() {} });
  try {
    handlers.Open(); await connection.startRecording();
    assert.equal(JSON.parse(sent[0].data).type, 'input.start');
    fixture.recorder.emit('Start');
    fixture.recorder.emit('Stop', { tempFilePath: '/tmp/first.wav' });
    await tick();
    assert.equal(fixture.recorder.starts.length, 2);
    assert.equal(sent[1].isBuffer, true);
    assert.equal(sent[1].data, Buffer.from(wavPcm(wav())).toString('base64'));
    connection.close(true);
    const before = fixture.recorder.stops;
    fixture.recorder.emit('Start');
    assert.equal(fixture.recorder.stops, before + 1);
    fixture.recorder.emit('Stop', { tempFilePath: '/tmp/last.wav' });
    await tick();
    assert.equal(fixture.load('services/speech').reserveRecorder({}), true);
    assert.equal(errors.length, 0);
  } finally { connection.close(true); }
});

test('ASR capacity pause stops only the host connection and discards its late recording tail', async () => {
  const { fixture, handlers, sent, service } = socketHarness();
  let disconnected = 0;
  const errors = [];
  const connection = service.connect({ roomId: '9223372036854775805', isHost: true }, {
    event() {}, error: error => errors.push(error), disconnected() { disconnected++; }
  });
  try {
    handlers.Open();
    await connection.startRecording();
    fixture.recorder.emit('Start');
    const count = sent.length;
    handlers.Message({ data: JSON.stringify({ type: 'segment.error', payload: { code: 'asr_capacity_exceeded', message: '识别积压已达上限' } }) });
    assert.equal(disconnected, 1);
    assert.ok(fixture.recorder.stops > 0);
    fixture.recorder.emit('Stop', { tempFilePath: '/tmp/rejected-tail.wav' });
    await tick();
    assert.equal(sent.length, count);
    assert.equal(fixture.load('services/speech').reserveRecorder({}), true);
    assert.deepEqual(errors, []);
  } finally { connection.close(true); }
});

test('room creation returns to navigation and recording survives hiding and unloading the room page', async () => {
  const { fixture, handlers } = socketHarness();
  const session = fixture.load('services/translation-session');
  const page = fixture.page('translation-room');
  let returned = 0;
  fixture.my.navigateBack = () => { returned++; };
  try {
    page.onLoad(); await tick();
    fixture.requests[0].ok({ canHost: true }); await tick();
    page.create(); await tick();
    fixture.requests[1].ok({ roomId: '9223372036854775805', code: '12345678', isHost: true, status: 'open' }); await tick();
    assert.equal(returned, 1);
    handlers.Open();
    await session.startSpeaking();
    fixture.recorder.emit('Start');
    const before = fixture.recorder.stops;
    page.onHide(); page.onUnload();
    assert.equal(fixture.recorder.stops, before);
    assert.equal(session.snapshot().speaking, true);
    const emit = event => handlers.Message({ data: JSON.stringify(event) });
    emit({ type: 'room.members.changed', payload: { roomId: '9223372036854775805', code: '12345678', isHost: true, listenerCount: 2, languages: [{ language: 'en', count: 1 }, { language: 'ja', count: 1 }], members: [{ userId: '9223372036854775804', displayName: 'Alice', language: 'en' }, { userId: '9223372036854775803', displayName: '游客', language: 'ja' }] } });
    for (const [targetLanguage, text] of [['en', 'Hello'], ['ja', 'こんにちは']]) emit({ type: 'translation.final', epochId: 'epoch', sequence: 1, targetLanguage, payload: { text } });
    const reopened = fixture.page('translation-room');
    reopened.onLoad(); await tick();
    assert.equal(reopened.data.room.roomId, '9223372036854775805');
    assert.equal(reopened.data.languageGroups[0].names, 'Alice');
    assert.equal(reopened.data.feed.length, 2);
    assert.equal(reopened.data.speaking, true);
    assert.equal(fixture.requests.length, 2);
    await session.leave();
    assert.equal(fixture.recorder.stops, before + 1);
    fixture.recorder.emit('Stop', { tempFilePath: '/tmp/last.wav' }); await tick();
    assert.equal(session.snapshot().room, null);
    assert.equal(session.snapshot().feed.length, 0);
    reopened.onUnload();
  } finally { await session.leave(); }
});

test('listener join returns to navigation, keeps subscribed language feed and resets on logout', async () => {
  const { fixture, handlers } = socketHarness();
  const session = fixture.load('services/translation-session');
  const page = fixture.page('translation-room');
  let returned = 0, closed = 0;
  fixture.my.navigateBack = () => { returned++; };
  fixture.my.closeSocket = () => { closed++; };
  page.onLoad(); await tick();
  fixture.requests[0].ok({ canHost: false }); await tick();
  page.setData({ code: '12345678' }); page.join(); await tick();
  const room = { roomId: '9223372036854775805', code: '12345678', isHost: false, status: 'open' };
  fixture.requests[1].ok(room); await tick();
  assert.equal(returned, 1);
  handlers.Open();
  const emit = event => handlers.Message({ data: JSON.stringify(event) });
  emit({ type: 'subscription.ready', targetLanguage: 'en', subscriptionVersion: 1, payload: { room, startSequence: 1 } });
  page.onUnload();
  emit({ type: 'translation.final', targetLanguage: 'ja', subscriptionVersion: 1, sequence: 1, payload: { text: 'こんにちは' } });
  emit({ type: 'translation.final', targetLanguage: 'en', subscriptionVersion: 1, sequence: 1, payload: { text: 'Hello' } });
  assert.equal(session.snapshot().feed.length, 1);
  assert.equal(session.snapshot().feed[0].text, 'Hello');
  assert.equal(closed, 0);
  fixture.auth.logout();
  assert.equal(closed, 1);
  assert.equal(session.snapshot().room, null);
  assert.equal(session.snapshot().feed.length, 0);
  assert.equal(handlers.Message, undefined);
});

test('room audio yields to other content and explicitly resumes without replaying interrupted segments', async () => {
  const { fixture, handlers } = socketHarness();
  const session = fixture.load('services/translation-session');
  const audio = fixture.load('services/audio');
  try {
    session.attach({ roomId: '42', isHost: false }); handlers.Open();
    const emit = event => handlers.Message({ data: JSON.stringify(event) });
    emit({ type: 'subscription.ready', targetLanguage: 'en', payload: { startSequence: 1, room: { roomId: '42', isHost: false } } });
    audio.playQueue('tour', [{ url: '/tour.mp3' }]);
    emit({ type: 'audio.delta', targetLanguage: 'en', sequence: 1, payload: { audio: 'aabb', isFinal: true } }); await tick();
    assert.equal(session.snapshot().paused, true);
    assert.equal(audio.snapshot().owner, 'tour');
    assert.equal(fixture.writes.length, 0);
    session.togglePause();
    assert.equal(session.snapshot().paused, false);
    assert.equal(audio.snapshot().owner, 'translation-room');
    emit({ type: 'audio.delta', targetLanguage: 'en', sequence: 2, payload: { audio: 'ccdd', isFinal: true } }); await tick();
    assert.equal(fixture.writes.length, 1);
    assert.equal(audio.snapshot().playing, true);
    session.suspend();
    assert.equal(session.snapshot().disconnected, true);
    assert.equal(fixture.audioContexts.at(-1).stopped, true);
    assert.equal(session.snapshot().room.roomId, '42');
  } finally {
    const leaving = session.leave(); await tick();
    const request = fixture.requests.at(-1); if (request) request.ok({});
    await leaving;
  }
});

test('listener playback state distinguishes missing audio, active playback and native playback failure', async () => {
  const { fixture, handlers } = socketHarness();
  const session = fixture.load('services/translation-session');
  const room = { roomId: '42', isHost: false };
  try {
    session.attach(room); handlers.Open();
    const emit = (type, payload) => handlers.Message({ data: JSON.stringify({ type, sequence: 1, targetLanguage: 'en', payload }) });
    emit('subscription.ready', { room });
    emit('translation.final', { text: 'Hello' });
    assert.match(session.snapshot().audioNotice, /Only text was received/);
    emit('audio.started', { format: 'mp3' });
    emit('audio.delta', { audio: 'aabb', isFinal: true }); await tick();
    assert.equal(session.snapshot().audioReceived, true);
    assert.match(session.snapshot().audioNotice, /Playing translated audio/);
    fixture.audioContexts[0].emit('Error', { errorMessage: 'Permission denied' });
    assert.match(session.snapshot().audioNotice, /Audio playback failed/);
    assert.equal(session.snapshot().disconnected, false);
    assert.ok(handlers.Message);
    session.togglePause();
    assert.equal(session.snapshot().audioError, '');
    assert.equal(session.snapshot().audioPlaying, true);
  } finally {
    const leaving = session.leave(); await tick();
    const request = fixture.requests.at(-1); if (request) request.ok({});
    await leaving;
  }
});

test('Alipay room selection localizes chat, playback, native title and errors across page reopening', async () => {
  const { fixture, handlers } = socketHarness();
  const session = fixture.load('services/translation-session');
  const titles = [];
  fixture.my.setNavigationBar = value => titles.push(value.title);
  const page = fixture.page('translation-room');
  page._visible = true;
  page.bindSession();
  let reopened;
  try {
    page.chooseLanguage({ currentTarget: { dataset: { index: 2 } } });
    assert.equal(page.data.language, 'en');
    assert.equal(page.data.messages.joinTitle, 'Join a commentary room');
    assert.equal(page.data.languageIndex, 2);
    assert.equal(titles.at(-1), 'Live commentary');
    const room = { roomId: '42', isHost: false, code: '12345678', sourceLanguage: 'zh-CN', listenerCount: 2 };
    page.attach(room); handlers.Open();
    const emit = event => handlers.Message({ data: JSON.stringify(event) });
    emit({ type: 'subscription.ready', targetLanguage: 'en', payload: { room } });
    assert.equal(page.data.listenerLabel, '2 listening');
    assert.match(page.data.notice, /^Joined/);
    assert.equal(titles.at(-1), 'Commentary chat');
    const base = { epochId: 'epoch', sequence: 1, targetLanguage: 'en' };
    emit({ ...base, type: 'translation.committed', payload: { text: '这里是银锭桥。' } });
    assert.equal(page.data.chatGroups[0].translations[0].displayText, 'Translating…');
    emit({ ...base, type: 'translation.final', payload: { text: 'This is Yinding Bridge.' } });
    assert.equal(page.data.chatGroups[0].translations[0].displayText, 'This is Yinding Bridge.');
    assert.match(page.data.audioNotice, /Only text was received/);
    emit({ type: 'room.snapshot', payload: room });
    page.onHide();
    reopened = fixture.page('translation-room'); reopened._visible = true; reopened.bindSession();
    assert.equal(reopened.data.language, 'en');
    assert.equal(reopened.data.languageIndex, 2);
    assert.equal(reopened.data.chatGroups[0].source, '这里是银锭桥。');
    emit({ type: 'subscription.changed', targetLanguage: 'ja', payload: { room } });
    assert.equal(reopened.data.language, 'ja');
    assert.equal(reopened.data.languageIndex, 3);
    assert.equal(reopened.data.messages.pause, '聴取を一時停止');
    assert.equal(reopened.data.chatGroups[0].translations[0].displayText, 'This is Yinding Bridge.');
    emit({ ...base, sequence: 2, targetLanguage: 'ja', type: 'language.error', payload: { message: '本段翻译中断，请等待下一段讲解' } });
    assert.equal(reopened.data.chatGroups[1].translations[0].displayText, reopened.data.messages.translationUnavailable);
    assert.equal(reopened.data.error, reopened.data.messages.translationUnavailable);
    emit({ type: 'segment.error', payload: { message: '本段识别失败，请车夫重复讲解' } });
    assert.match(reopened.data.error, /音声認識/);
    assert.equal(titles.at(-1), '解説チャット');
    emit({ type: 'room.closed', payload: { mode: 'immediate' } });
    assert.equal(reopened.data.notice, 'ルームが閉じられました');
  } finally {
    page.onUnload(); if (reopened) reopened.onUnload();
    const leaving = session.leave(); await tick();
    const request = fixture.requests.at(-1); if (request) request.ok({});
    await leaving;
  }
});

test('Alipay navigation passes its selected language into a new room and preserves active subscriptions', async () => {
  const { fixture, handlers } = socketHarness();
  const session = fixture.load('services/translation-session');
  const { tourMessages } = fixture.load('shared/tourMessages');
  const tourPage = fixture.page('tour');
  let destination;
  fixture.my.navigateTo = options => { destination = options.url; };
  tourPage.setData({ locale: 'en', messages: tourMessages('en') });
  tourPage.translationRoom();
  assert.equal(tourPage.data.messages.liveCommentary, 'Live commentary');
  assert.equal(tourPage.data.messages.commentaryRoom, 'Room');
  assert.equal(destination, '/pages/translation-room/index');
  assert.equal(session.snapshot().language, 'en');
  const roomPage = fixture.page('translation-room');
  roomPage._visible = true; roomPage.bindSession();
  try {
    assert.equal(roomPage.data.languageIndex, 2);
    assert.equal(roomPage.data.messages.joinTitle, 'Join a commentary room');
    session.attach({ roomId: '42', isHost: false }, 'ja'); handlers.Open();
    tourPage.setData({ locale: 'fr' });
    tourPage.translationRoom();
    assert.equal(session.snapshot().language, 'ja');
    assert.equal(roomPage.data.messages.joinTitle, '解説ルームに参加');
  } finally {
    roomPage.onUnload();
    const leaving = session.leave(); await tick();
    const request = fixture.requests.at(-1); if (request) request.ok({});
    await leaving;
  }
});
