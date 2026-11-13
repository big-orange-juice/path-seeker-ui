let initialized = false, supported = false, active = false, resumeRequired = false, version = 0;
const listeners = new Set();
const blocked = () => active || resumeRequired;
const snapshot = () => ({ supported, active, resumeRequired, version });
function publish(event) { listeners.forEach(listener => listener(snapshot(), event)); }
function begin() {
  if (active) return;
  active = true; resumeRequired = true; version++;
  publish('begin');
}
function end() {
  if (!active) return;
  active = false; version++;
  publish('end');
}
function init() {
  if (initialized) return supported;
  if (typeof my.onAudioInterruptionBegin !== 'function' || typeof my.onAudioInterruptionEnd !== 'function') return false;
  initialized = true;
  try {
    my.onAudioInterruptionBegin(() => { if (supported) begin(); });
    my.onAudioInterruptionEnd(() => { if (supported) end(); });
    supported = true;
  } catch (_) { supported = false; }
  return supported;
}
function resumeManually() {
  if (active) return false;
  if (resumeRequired) { resumeRequired = false; version++; publish('manual-resume'); }
  return true;
}
function subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); }
init();
module.exports = { init, blocked, snapshot, resumeManually, subscribe };
