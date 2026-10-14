const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const dist = path.resolve(__dirname, '../dist');
const userId = '9223372036854775806';
const session = (id = userId, token = 'access') => ({ userId: id, accessToken: token, refreshToken: 'refresh', isGuest: true });
function harness(initial = session()) {
  const storage = new Map(), requests = [], audioContexts = [], removed = [], writes = [], confirms = [];
  if (initial) storage.set('path-seeker:alipay:v1:session', initial);
  function emitter() {
    const handlers = new Map();
    const object = { emit(name, data) { return [...(handlers.get(name) || [])].map(fn => fn(data)); }, callbacks(name) { return [...(handlers.get(name) || [])]; } };
    for (const name of ['Start', 'Stop', 'Error', 'Play', 'Pause', 'Ended', 'TimeUpdate', 'CanPlay']) {
      object['on' + name] = fn => { if (!handlers.has(name)) handlers.set(name, new Set()); handlers.get(name).add(fn); };
      object['off' + name] = fn => { if (handlers.has(name)) handlers.get(name).delete(fn); };
    }
    return object;
  }
  const recorder = Object.assign(emitter(), { starts: [], stops: 0, start(params) { this.starts.push(params); }, stop() { this.stops++; } });
  const wav = Buffer.from('RIFF0000WAVEbinary\x00\xff', 'latin1');
  const wavBuffer = () => Uint8Array.from(wav).buffer;
  const my = {
    getStorageSync: ({ key }) => ({ data: storage.get(key) }), setStorageSync: ({ key, data }) => storage.set(key, data), removeStorageSync: ({ key }) => storage.delete(key),
    getSystemInfoSync: () => ({ platform: 'Android', model: 'test' }),
    request(options) { const task = { options, aborted: false, abort() { this.aborted = true; }, ok(data, status = 200) { options.success({ data: { code: 0, data }, status }); }, text(data) { options.success({ data, status: 200 }); }, reject(error) { options.fail(error); } }; requests.push(task); return task; },
    createInnerAudioContext() {
      const audio = Object.assign(emitter(), { currentTime: 0, duration: 60, stopped: false, destroyed: false, play() { this.emit('Play'); }, pause() { this.emit('Pause'); }, stop() { this.stopped = true; this.emit('Stop'); }, destroy() { this.destroyed = true; }, seek(time) { this.currentTime = time; } });
      audioContexts.push(audio); return audio;
    },
    getRecorderManager: () => recorder, env: { USER_DATA_PATH: '/data' },
    getFileSystemManager: () => ({ readFile(p) { p.success({ data: wavBuffer() }); }, writeFile(p) { writes.push(p); p.success({}); }, unlink(p) { removed.push(p.filePath); p.success({}); } }),
    confirm(p) { confirms.push(p); }, showToast() {}, switchTab() {}, navigateTo() {},
    getLocation() {},
  };
  let definition;
  const app = { globalData: { chatContext: null, selectedRoute: '' } };
  const context = vm.createContext({ my, Page: d => { definition = d; }, getApp: () => app, console, setTimeout, clearTimeout, ArrayBuffer, Uint8Array });
  const cache = new Map();
  function load(name) {
    const filename = path.resolve(dist, name.endsWith('.js') ? name : name + '.js');
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} }; cache.set(filename, module);
    const run = vm.runInContext('(function(require,module,exports){' + fs.readFileSync(filename, 'utf8') + '\n})', context, { filename });
    run(relative => load(path.relative(dist, path.resolve(path.dirname(filename), relative))), module, module.exports);
    return module.exports;
  }
  function page(name) {
    load('pages/' + name + '/index');
    const p = Object.assign({}, definition, { data: JSON.parse(JSON.stringify(definition.data)), setData(update) { for (const [key, value] of Object.entries(update)) { const parts = key.split('.'); let target = this.data; for (const part of parts.slice(0, -1)) target = target[part]; target[parts.at(-1)] = value; } } });
    return p;
  }
  const auth = load('services/auth'); auth.restore();
  return { load, page, auth, my, storage, requests, audioContexts, recorder, removed, writes, confirms, wav, wavBuffer, app };
}
const tick = () => new Promise(resolve => setImmediate(resolve));
const plain = data => JSON.parse(JSON.stringify(data));
module.exports = { harness, tick, plain, session, userId };
