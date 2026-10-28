const { test } = require('node:test');
const assert = require('node:assert/strict');
const { harness, tick, plain, session, userId } = require('./harness.cjs');

test('明信片入口可在普通登录无需手机号时单独要求签名手机号授权', async () => {
  const h = harness(); h.my.getAuthCode = o => o.success({ authCode: 'code' });
  let returned = false; h.my.pages = [{}, {}]; h.my.navigateBack = () => { returned = true; };
  const page = h.page('auth'); page.onLoad({ phone: '1' }); page.setData({ agreed: true });
  page.onShow();
  const login = page.alipay(); await tick();
  assert.equal(page.data.requirePhoneNumber, true);
  assert.equal(h.requests[0].options.data.phoneResponse, 'signed-phone-response');
  h.requests[0].ok({ ...session(), isGuest: false }); await login;
  assert.equal(returned, true);
});

test('段间音乐和视频按位置插入，节点和附件的大 ID 保持字符串', () => {
  const h = harness(), service = h.load('services/postcards'), tour = h.load('core/tour');
  const detail = { stops: [{ id: userId, guideNarrations: [{ chapters: [{ id: 'first', order: 1, text: '前', audioUrl: '/one.mp3' }, { id: 'second', order: 2, text: '后', audioUrl: '/two.mp3' }] }] }] };
  service.decorate(detail, [{ stageId: userId, enabled: true, media: [{ id: 'video', afterSegmentNo: 1, order: 2, kind: 'video', url: '/v.mp4' }, { id: 'music', afterSegmentNo: 1, order: 1, kind: 'audio', url: '/m.mp3' }] }]);
  const stop = detail.stops[0], guide = stop.guideNarrations[0];
  assert.equal(stop.experience.stageId, userId);
  assert.deepEqual(plain(tour.queueFor(stop, guide)).map(i => i.id), ['first', 'music', 'video', 'second']);
  assert.deepEqual(plain(tour.queueFor(stop, guide, { skipExtra: true })).map(i => i.id), ['first', 'second']);
});

test('视频不会提前完成节点；原生暂停续播、结束和切站后的迟到事件均正确处理', () => {
  const h = harness(), audio = h.load('services/audio'); let finished = 0, visible = null;
  const commands = [], hooks = { video: (item, token) => { visible = item && { ...item, token }; }, videoControl: c => commands.push(c), finished: () => finished++ };
  const items = [{ id: 'first', kind: 'chapter', url: '/one.mp3' }, { id: 'film', kind: 'interlude-video', url: '/v.mp4' }, { id: 'second', kind: 'chapter', url: '/two.mp3' }];
  audio.playQueue('tour', items, hooks); h.audioContexts[0].emit('Ended');
  assert.equal(visible.id, 'film'); assert.equal(finished, 0);
  const token = visible.token;
  audio.videoEvent('play', token, 'film'); audio.pause(); audio.resume('tour');
  assert.deepEqual(commands, ['pause', 'play']);
  audio.videoEvent('ended', token, 'film'); assert.equal(visible, null); assert.equal(audio.snapshot().item.id, 'second'); assert.equal(finished, 0);
  h.audioContexts.at(-1).emit('Ended'); assert.equal(finished, 1);
  audio.playQueue('tour', [{ id: 'next', kind: 'chapter', url: '/next.mp3' }], hooks);
  audio.videoEvent('ended', token, 'film'); assert.equal(audio.snapshot().item.id, 'next'); assert.equal(finished, 1); audio.stop();
});

test('我的页面需要正式账号和服务端手机号，未授权时不请求历史明信片', async () => {
  const h = harness({ ...session(), isGuest: false }), page = h.page('postcards'); page.onLoad({});
  const load = page.load(); await tick(); h.requests[0].ok({ id: userId, phone: null }); await load;
  assert.equal(page.data.eligible, false); assert.equal(h.requests.length, 1);
});

test('账号切换后旧明信片详情不可回填', async () => {
  const h = harness({ ...session(), isGuest: false }), page = h.page('postcards'); page.onLoad({});
  const opened = page.open({ currentTarget: { dataset: { id: userId } } }); await tick();
  h.auth.logout(); h.requests[0].ok({ id: userId, status: 'completed' }); await opened;
  assert.equal(page.data.selected, null);
});
