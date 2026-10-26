import test, { after, type TestContext } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdtemp, rm } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createPinia, setActivePinia } from 'pinia'
import { effectScope } from 'vue'

const require = createRequire(import.meta.url)
const { build } = createRequire(require.resolve('vite'))('esbuild')
const project = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const temporary = await mkdtemp(resolve(project, 'tests/.runtime-'))
after(async () => { await rm(temporary, { recursive: true, force: true }) })
const fixtures: Record<string, string> = {
  '@/stores/useAuthStore': `import { defineStore } from 'pinia'; export const useAuthStore = defineStore('fixture-auth', { state: () => ({ profile: { id: '9223372036854775806' } }) });`,
  '@/services/translationRoom': `
    export const fixture = { sockets: [], requests: [], pending: null, microphone: null, stops: 0 };
    export async function roomRequest(path, data) {
      fixture.requests.push({ path, data });
      if (fixture.pending) return fixture.pending;
      if (path === '/host-permission') return { canHost: true };
      return { roomId: '9223372036854775805', code: '12345678', isHost: path !== '/join', status: 'open' };
    }
    export function roomSocket(id, channel) {
      const socket = { id, channel, readyState: 1, bufferedAmount: 0, closed: false, send() {}, close() { this.closed = true; this.readyState = 3; } };
      fixture.sockets.push(socket); return socket;
    }`,
  'mic.js': `import { fixture } from '@/services/translationRoom'; export async function startTranslationMic() { if (fixture.microphone) return fixture.microphone; return { async stop() { fixture.stops++; } }; }`,
  'pcm.js': 'export const createPcmEncoder = () => ({ feed() {}, flush() {} });',
}
await build({
  stdin: { contents: "export { useTranslationRoom, useTranslationRoomStore } from './src/composables/useTranslationRoom'; export { useAuthStore } from '@/stores/useAuthStore'; export { fixture } from '@/services/translationRoom';", resolveDir: project },
  bundle: true, platform: 'node', format: 'esm', outfile: resolve(temporary, 'session.mjs'),
  external: ['vue', 'pinia'], alias: { '@': resolve(project, 'src') },
  plugins: [{ name: 'room-fixture', setup(builder: any) {
    builder.onResolve({ filter: /^(?:@\/|.*\/(?:mic|pcm|player)\.js$)/ }, (args: { path: string }) => {
      const key = fixtures[args.path] ? args.path : args.path.split('/').at(-1)!
      return fixtures[key] ? { path: key, namespace: 'fixture' } : undefined
    })
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, (args: { path: string }) => ({ contents: fixtures[args.path] }))
  } }],
})
const { useTranslationRoom, useTranslationRoomStore, useAuthStore, fixture } = await import(pathToFileURL(resolve(temporary, 'session.mjs')).href)
const tick = () => new Promise(resolveTick => setImmediate(resolveTick))

function setup(context: TestContext) {
  const originalAudioContext = Object.getOwnPropertyDescriptor(globalThis, 'AudioContext')
  Object.defineProperty(globalThis, 'AudioContext', { configurable: true, writable: true, value: class {
    sampleRate = 48000
    state = 'suspended'
    currentTime = 0
    destination = {}
    onstatechange: (() => void) | null = null
    constructor() { fixture.context = this }
    async resume() { if (fixture.resumeFailure) throw Error('Audio resume denied'); this.state = 'running'; this.onstatechange?.() }
    async suspend() { this.state = 'suspended'; this.onstatechange?.() }
    async close() { this.state = 'closed' }
    createBuffer() { return { getChannelData: () => new Float32Array(1) } }
    createBufferSource() {
      const source = { buffer: null, onended: null, stopped: false, connect() {}, disconnect() {}, stop() { this.stopped = true }, start() { fixture.played.push(this) } }
      return source
    }
    async decodeAudioData() { if (fixture.decodeFailure) throw Error('Invalid audio'); return { duration: 1 } }
  } })
  context.after(() => { if (originalAudioContext) Object.defineProperty(globalThis, 'AudioContext', originalAudioContext); else Reflect.deleteProperty(globalThis, 'AudioContext') })
  context.mock.property(globalThis, 'WebSocket', { OPEN: 1 })
  fixture.sockets = []; fixture.requests = []; fixture.pending = null; fixture.microphone = null; fixture.stops = 0
  fixture.played = []; fixture.resumeFailure = false; fixture.decodeFailure = false
  setActivePinia(createPinia())
  const store = useTranslationRoomStore()
  context.after(async () => { await store.leave(false); store.$dispose() })
  return store
}

test('returning from room page preserves socket, microphone and multilingual feed in application session', async context => {
  const store = setup(context)
  const page = effectScope()
  const first = page.run(() => useTranslationRoom())!
  await first.create('zh-CN')
  fixture.sockets[0].onopen()
  const starting = first.startSpeaking()
  await tick()
  fixture.sockets[1].onopen()
  await starting
  const emit = (targetLanguage: string, text: string) => fixture.sockets[0].onmessage({ data: JSON.stringify({ type: 'translation.final', epochId: 'epoch', sequence: 1, targetLanguage, payload: { text } }) })
  emit('en', 'Hello'); emit('ja', 'こんにちは')
  page.stop()
  assert.equal(store.speaking, true)
  assert.equal(fixture.stops, 0)
  assert.equal(fixture.sockets.some((socket: any) => socket.closed), false)
  const nextPage = effectScope()
  const reopened = nextPage.run(() => useTranslationRoom())!
  assert.equal(reopened.room.value.roomId, '9223372036854775805')
  assert.deepEqual(reopened.feed.value.map((item: any) => item.language), ['en', 'ja'])
  assert.equal(fixture.sockets.length, 2)
  await reopened.leave()
  assert.equal(fixture.stops, 1)
  assert.equal(fixture.sockets.every((socket: any) => socket.closed), true)
  assert.equal(store.room, null)
  assert.deepEqual(store.feed, [])
  nextPage.stop()
})

test('account switch discards room and feed without notifying server using the next account', async context => {
  const store = setup(context)
  await store.join('12345678', 'en')
  const socket = fixture.sockets[0]
  socket.onmessage({ data: JSON.stringify({ type: 'subscription.ready', targetLanguage: 'en', payload: { room: store.room } }) })
  socket.onmessage({ data: JSON.stringify({ type: 'translation.final', targetLanguage: 'en', sequence: 1, payload: { text: 'Hello' } }) })
  assert.equal(store.feed.length, 1)
  useAuthStore().profile = { id: '9223372036854775804' }
  await tick()
  assert.equal(store.room, null)
  assert.equal(store.feed.length, 0)
  assert.equal(socket.closed, true)
  assert.equal(fixture.requests.some((request: any) => request.path.endsWith('/leave')), false)
})

test('late permission and room responses cannot restore the previous account session', async context => {
  const store = setup(context)
  let finish!: (value: object) => void
  fixture.pending = new Promise(resolvePending => { finish = resolvePending })
  const permission = store.loadPermission()
  const creating = store.create('zh-CN')
  useAuthStore().profile = { id: '9223372036854775804' }
  finish({ canHost: true, roomId: 'old-room', isHost: true })
  await permission
  assert.equal(await creating, false)
  assert.equal(store.canHost, false)
  assert.equal(store.permissionPending, true)
  assert.equal(store.room, null)
  assert.equal(fixture.sockets.length, 0)
})

test('microphone permission resolving after logout immediately releases the late capture', async context => {
  const store = setup(context)
  await store.create('zh-CN')
  let release!: (value: object) => void
  fixture.microphone = new Promise(resolveMic => { release = resolveMic })
  const starting = store.startSpeaking()
  await tick()
  fixture.sockets[1].onopen()
  await tick()
  useAuthStore().profile = null
  release({ async stop() { fixture.stops++ } })
  await starting
  assert.equal(store.speaking, false)
  assert.equal(store.room, null)
  assert.equal(fixture.stops, 1)
  assert.equal(fixture.sockets[1].closed, true)
})

test('listener receives and plays real audio queue while browser suspension can be resumed with one tap', async context => {
  const store = setup(context)
  await store.join('12345678', 'en')
  const socket = fixture.sockets[0]
  const emit = (type: string, payload: object) => socket.onmessage({ data: JSON.stringify({ type, targetLanguage: 'en', sequence: 1, payload }) })
  emit('subscription.ready', { room: store.room })
  emit('translation.committed', { text: '你好' })
  emit('audio.started', { format: 'mp3', sampleRate: 32000 })
  await fixture.context.suspend()
  assert.equal(store.audioBlocked, true)
  emit('audio.delta', { audio: 'aabb', encoding: 'hex', isFinal: true })
  await tick()
  assert.equal(store.audioReceived, true)
  assert.equal(fixture.played.length, 2)
  assert.match(store.audioNotice, /browser paused audio/)
  await store.toggleMute()
  assert.equal(fixture.context.state, 'running')
  assert.equal(store.muted, false)
  assert.equal(store.audioBlocked, false)
  assert.match(store.audioNotice, /Playing translated audio/)
  emit('translation.final', { text: 'Hello' })
  assert.equal(store.audioError, '')
  assert.equal(socket.closed, false)
})

test('translation without audio reports missing speech and keeps the text connection open', async context => {
  const store = setup(context)
  await store.join('12345678', 'en')
  const socket = fixture.sockets[0]
  socket.onmessage({ data: JSON.stringify({ type: 'subscription.ready', targetLanguage: 'en', payload: { room: store.room } }) })
  socket.onmessage({ data: JSON.stringify({ type: 'translation.final', targetLanguage: 'en', sequence: 1, payload: { text: 'Hello' } }) })
  assert.match(store.audioNotice, /Only text was received/)
  assert.equal(store.feed[0].text, 'Hello')
  assert.equal(store.listening, true)
  assert.equal(socket.closed, false)
})

test('audio decode failure keeps translation live and a resume attempt reports browser rejection', async context => {
  const store = setup(context)
  await store.join('12345678', 'en')
  const socket = fixture.sockets[0]
  socket.onmessage({ data: JSON.stringify({ type: 'subscription.ready', targetLanguage: 'en', payload: { room: store.room } }) })
  fixture.decodeFailure = true
  socket.onmessage({ data: JSON.stringify({ type: 'audio.delta', targetLanguage: 'en', sequence: 1, payload: { audio: 'aabb', isFinal: true } }) })
  await tick()
  assert.match(store.audioNotice, /Audio playback failed/)
  assert.equal(store.audioBlocked, true)
  assert.equal(store.listening, true)
  assert.equal(socket.closed, false)
  fixture.resumeFailure = true
  assert.equal(await store.toggleMute(), false)
  assert.match(store.error, /Audio resume denied/)
  fixture.resumeFailure = false
  fixture.decodeFailure = false
  assert.equal(await store.toggleMute(), true)
  assert.equal(store.audioError, '')
})

test('room language localizes live notices and survives navigation, snapshots and subscription changes', async context => {
  const store = setup(context)
  store.setLanguage('en')
  assert.equal(store.messages.joinTitle, 'Join a commentary room')
  await store.join('12345678', 'en')
  const socket = fixture.sockets[0]
  const emit = (type: string, payload: object, targetLanguage?: string) => socket.onmessage({ data: JSON.stringify({ type, payload, targetLanguage }) })
  emit('subscription.ready', { room: store.room }, 'en')
  assert.match(store.displayNotice, /^Joined/)
  emit('room.paused', {})
  assert.match(store.displayNotice, /guide is offline/)
  emit('room.snapshot', { ...store.room, listenerCount: 2 })
  const page = effectScope()
  const reopened = page.run(() => useTranslationRoom())!
  assert.equal(reopened.language.value, 'en')
  assert.equal(reopened.messages.value.pause, 'Pause listening')
  page.stop()
  emit('subscription.changed', { room: store.room }, 'ja')
  assert.equal(store.language, 'ja')
  assert.match(store.displayNotice, /参加しました/)
  emit('segment.error', { message: '本段识别失败，请车夫重复讲解' })
  assert.match(store.displayError, /音声認識/)
  emit('audio.error', { message: '语音合成暂时不可用' }, 'ja')
  assert.match(store.audioNotice, /字幕をご覧ください/)
  assert.doesNotMatch(store.displayError, /语音合成/)
  emit('room.closed', { mode: 'immediate' })
  assert.equal(store.displayNotice, 'ルームが閉じられました')
})

test('host interface follows source language rather than per-listener translated language', async context => {
  const store = setup(context)
  await store.create('fr')
  fixture.sockets[0].onmessage({ data: JSON.stringify({ type: 'subscription.ready', targetLanguage: 'ja', payload: { room: store.room } }) })
  assert.equal(store.language, 'fr')
  assert.equal(store.messages.start, 'Commencer le commentaire')
})

test('navigation language initializes room entry while an active room keeps its listening language', async context => {
  const store = setup(context)
  store.prepareEntry('en', '/tour?lang=en')
  assert.equal(store.language, 'en')
  assert.equal(store.messages.joinTitle, 'Join a commentary room')
  assert.equal(store.navigationPath, '/tour?lang=en')
  await store.join('12345678', 'ja')
  store.prepareEntry('fr', '/tour?lang=fr')
  assert.equal(store.language, 'ja')
  assert.equal(store.messages.joinTitle, '解説ルームに参加')
  assert.equal(store.navigationPath, '/tour?lang=fr')
})
