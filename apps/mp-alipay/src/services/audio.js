// 按 owner 排他使用；每段重建上下文，迟到的旧段事件不可推进新队列。
let context = null, owner = '', queue = [], index = 0, hooks = {}, generation = 0, failed = false, playing = false;
let accepting = false, finished = false, paused = false, prepared = null;
let video = null;
let completedItemIds = [];
const isExtra = item => item && ['before', 'after', 'interlude-audio', 'interlude-video'].includes(item.kind);
const listeners = {};
function discardPrepared() {
  if (!prepared) return;
  const old = prepared; prepared = null;
  old.context.offError(old.error);
  old.context.stop(); old.context.destroy();
}
function prepareNext(token) {
  const item = queue[index + 1];
  if (token !== generation || !context || !item || item.kind === 'interlude-video' || !item.url || prepared) return;
  let warm;
  try {
    warm = my.createInnerAudioContext();
    const error = () => { if (prepared && prepared.context === warm) discardPrepared(); };
    prepared = { context: warm, item, error };
    warm.autoplay = false; warm.obeyMuteSwitch = false;
    warm.onError(error);
    warm.src = item.url;
  } catch (_) { if (prepared && prepared.context === warm) discardPrepared(); }
}
function dispose() {
  const old = context; context = null;
  if (!old) return;
  Object.keys(listeners).forEach(name => { if (old['off' + name]) old['off' + name](listeners[name]); });
  old.stop(); old.destroy();
}
function create(token) {
  if (!my.createInnerAudioContext) throw Error('当前支付宝版本不支持音频，请更新客户端');
  const warm = prepared && prepared.item === queue[index] ? prepared : null;
  if (warm) { prepared = null; warm.context.offError(warm.error); }
  else discardPrepared();
  context = warm ? warm.context : my.createInnerAudioContext();
  const active = context;
  const valid = () => token === generation && active === context;
  context.autoplay = false;
  context.obeyMuteSwitch = false;
  // 息屏/切后台继续播放；需 app.json 声明 requiredBackgroundModes: ["audio"]。
  try { context.supportBackgroundPlay = true; } catch (_) {}
  listeners.Play = () => { if (valid()) { if (paused) { active.pause(); return; } playing = true; notify(); } };
  listeners.Pause = () => { if (valid()) { playing = false; notify(); } };
  listeners.Stop = () => { if (valid()) { playing = false; notify(); } };
  listeners.TimeUpdate = () => { if (valid()) notify(); };
  listeners.CanPlay = () => {
    if (valid() && pendingSeek !== null) { active.seek(pendingSeek); pendingSeek = null; }
  };
  listeners.Ended = () => {
    if (!valid() || failed) return;
    playing = false;
    completedItemIds.push(queue[index].id);
    if (hooks.itemEnded) hooks.itemEnded(queue[index]);
    if (!valid()) return;
    index++;
    next(token);
  };
  listeners.Error = error => {
    if (!valid()) return;
    playing = false;
    const extra = isExtra(queue[index]);
    failed = !extra;
    if (hooks.error) hooks.error(Error(error.errorMessage || '音频播放失败，可重试或阅读讲解'));
    if (!valid()) return;
    if (extra) { index++; next(token); return; }
    notify();
  };
  Object.keys(listeners).forEach(name => context['on' + name](listeners[name]));
  return context;
}
let pendingSeek = null;
function snapshot() {
  return { owner, playing, requested: !!queue[index] && !paused && !failed, index, item: queue[index] || null, time: video ? video.time : pendingSeek !== null ? pendingSeek : context ? context.currentTime || 0 : 0, duration: video ? video.duration : context ? context.duration || 0 : 0, failed, generation };
}
function notify() { if (hooks.change) hooks.change(snapshot()); }
function next(token) {
  if (token !== generation) return;
  dispose();
  if (video && hooks.video) hooks.video(null, token);
  video = null;
  playing = false;
  const item = queue[index];
  if (!item) {
    notify();
    if (!accepting && !finished) { finished = true; if (hooks.finished) hooks.finished({ failed, completedItemIds: completedItemIds.slice() }); }
    return;
  }
  if (!item.url) {
    const extra = isExtra(item);
    failed = !extra;
    if (hooks.error) hooks.error(Error('本段暂无录音，请阅读内容后手动完成'));
    if (token !== generation) return;
    if (extra) { index++; next(token); return; }
    notify();
    return;
  }
  if (item.kind === 'interlude-video') {
    discardPrepared(); video = { time: pendingSeek || 0, duration: 0 }; pendingSeek = null;
    if (!hooks.video) { if (hooks.error) hooks.error(Error('此页面暂不支持段间视频')); video = null; index++; next(token); return; }
    hooks.video(Object.assign({}, item, { startTime: video.time, paused }), token); notify(); return;
  }
  create(token);
  if (context.src !== item.url) context.src = item.url;
  if (!paused) context.play();
  prepareNext(token);
  notify();
}
function playQueue(nextOwner, items, nextHooks = {}, checkpoint = {}) {
  stop();
  owner = nextOwner; queue = items; hooks = nextHooks;
  index = Math.max(0, Math.min(checkpoint.index || 0, Math.max(0, items.length - 1)));
  failed = false;
  pendingSeek = checkpoint.time > 0 ? checkpoint.time : null;
  next(generation);
}
function pause() { paused = true; if (context) context.pause(); if (video && hooks.videoControl) hooks.videoControl('pause'); playing = false; notify(); }
function resume(expectedOwner) {
  if (owner !== expectedOwner) return;
  paused = false;
  if (!queue[index]) return;
  if (video) { if (hooks.videoControl) hooks.videoControl('play'); return; }
  if (failed || !context) { failed = false; next(generation); } else context.play();
}
function stop(expectedOwner) {
  if (expectedOwner && owner !== expectedOwner) return;
  generation++;
  if (video && hooks.video) hooks.video(null, generation);
  video = null;
  hooks = {}; playing = false; pendingSeek = null; accepting = false; finished = false; paused = false; completedItemIds = [];
  discardPrepared();
  dispose();
  queue = []; index = 0; owner = ''; failed = false;
}
function seek(seconds, expectedOwner) {
  if (video && owner === expectedOwner) { video.time = Math.max(0, seconds); if (hooks.videoControl) hooks.videoControl('seek', video.time); notify(); return; }
  if (context && owner === expectedOwner) context.seek(Math.max(0, Math.min(seconds, context.duration || seconds)));
}
function videoEvent(kind, token, id, detail = {}) {
  if (!video || Number(token) !== generation || !queue[index] || queue[index].id !== id) return;
  if (kind === 'time') { video.time = Number(detail.currentTime) || 0; video.duration = Number(detail.duration) || 0; }
  if (kind === 'play') { playing = true; paused = false; }
  if (kind === 'pause') { playing = false; paused = true; }
  if (kind === 'ended' || kind === 'skip' || kind === 'error') {
    if (kind === 'ended') completedItemIds.push(queue[index].id);
    if (kind === 'error' && hooks.error) hooks.error(Error('段间视频播放失败，已继续讲解'));
    if (Number(token) !== generation) return;
    if (hooks.itemEnded) hooks.itemEnded(queue[index]);
    if (Number(token) !== generation) return;
    paused = false; index++; next(generation); return;
  }
  notify();
}
function destroy() {
  stop();
}
function beginStream(nextOwner, nextHooks) {
  stop(); owner = nextOwner; hooks = nextHooks || {}; accepting = true;
  return generation;
}
function appendStream(token, item) {
  if (token !== generation || !accepting || failed) return;
  queue.push(item);
  if (!context && index === queue.length - 1) next(token);
  else prepareNext(token);
}
function finishStream(token) {
  if (token !== generation) return;
  accepting = false;
  if (index >= queue.length) next(token);
}
module.exports = { playQueue, pause, resume, stop, seek, snapshot, destroy, beginStream, appendStream, finishStream, videoEvent };
