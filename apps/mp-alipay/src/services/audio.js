// 按 owner 排他使用；每段重建上下文，迟到的旧段事件不可推进新队列。
let context = null, owner = '', queue = [], index = 0, hooks = {}, generation = 0, failed = false, playing = false;
let accepting = false, finished = false;
const listeners = {};
function dispose() {
  const old = context; context = null;
  if (!old) return;
  Object.keys(listeners).forEach(name => { if (old['off' + name]) old['off' + name](listeners[name]); });
  old.stop(); old.destroy();
}
function create(token) {
  if (!my.createInnerAudioContext) throw Error('当前支付宝版本不支持音频，请更新客户端');
  context = my.createInnerAudioContext();
  const active = context;
  const valid = () => token === generation && active === context;
  context.autoplay = false;
  context.obeyMuteSwitch = false;
  listeners.Play = () => { if (valid()) { playing = true; notify(); } };
  listeners.Pause = () => { if (valid()) { playing = false; notify(); } };
  listeners.Stop = () => { if (valid()) { playing = false; notify(); } };
  listeners.TimeUpdate = () => { if (valid()) notify(); };
  listeners.CanPlay = () => {
    if (valid() && pendingSeek !== null) { active.seek(pendingSeek); pendingSeek = null; }
  };
  listeners.Ended = () => {
    if (!valid() || failed) return;
    playing = false;
    if (hooks.itemEnded) hooks.itemEnded(queue[index]);
    if (!valid()) return;
    index++;
    next(token);
  };
  listeners.Error = error => {
    if (!valid()) return;
    playing = false;
    const extra = queue[index] && ['before', 'after'].includes(queue[index].kind);
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
  return { owner, playing, index, item: queue[index] || null, time: context ? context.currentTime || 0 : 0, duration: context ? context.duration || 0 : 0, failed, generation };
}
function notify() { if (hooks.change) hooks.change(snapshot()); }
function next(token) {
  if (token !== generation) return;
  dispose();
  playing = false;
  const item = queue[index];
  if (!item) {
    notify();
    if (!accepting && !finished) { finished = true; if (hooks.finished) hooks.finished({ failed }); }
    return;
  }
  if (!item.url) {
    const extra = ['before', 'after'].includes(item.kind);
    failed = !extra;
    if (hooks.error) hooks.error(Error('本段暂无录音，请阅读内容后手动完成'));
    if (token !== generation) return;
    if (extra) { index++; next(token); return; }
    notify();
    return;
  }
  create(token); context.src = item.url;
  context.play();
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
function pause() { if (context) context.pause(); playing = false; notify(); }
function resume(expectedOwner) {
  if (owner !== expectedOwner || !queue[index]) return;
  if (failed || !context) { failed = false; next(generation); } else context.play();
}
function stop(expectedOwner) {
  if (expectedOwner && owner !== expectedOwner) return;
  generation++;
  hooks = {}; playing = false; pendingSeek = null; accepting = false; finished = false;
  dispose();
  queue = []; index = 0; owner = ''; failed = false;
}
function seek(seconds, expectedOwner) {
  if (context && owner === expectedOwner) context.seek(Math.max(0, Math.min(seconds, context.duration || seconds)));
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
}
function finishStream(token) {
  if (token !== generation) return;
  accepting = false;
  if (index >= queue.length) next(token);
}
module.exports = { playQueue, pause, resume, stop, seek, snapshot, destroy, beginStream, appendStream, finishStream };
