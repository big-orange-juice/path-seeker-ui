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
      const socket = { id, channel, readyState: 1, bufferedAmount: 0, closed: false, sent: [], send(value) { this.sent.push(value); }, close() { this.closed = true; this.readyState = 3; } };
      fixture.sockets.push(socket); return socket;
    }`,
  '@/services/roomQuestions': `import { fixture } from '@/services/translationRoom'; export async function uploadRoomQuestion(roomId, wav, requestId, signal) { fixture.uploads.push({ roomId, wav, requestId, signal }); if (fixture.uploadPending) return fixture.uploadPending; return { questionId: 'question-1', status: 'accepted' }; }`,
  'mic.js': `import { fixture } from '@/services/translationRoom'; export async function startTranslationMic(context, onFrame) { fixture.onFrame = onFrame; if (fixture.microphone) return fixture.microphone; return { async stop(options) { fixture.stops++; await fixture.stopHook?.(options); } }; }`,
  'pcm.js': `import { fixture } from '@/services/translationRoom'; export const createPcmEncoder = (rate, send) => ({ feed(frame) { fixture.frames.push(frame.length); send(new ArrayBuffer(frame.length * 2)); }, flush() { fixture.flushes++; send(new ArrayBuffer(4)); } });`,
  '@/utils/roomEchoGuard': `import { fixture } from '@/services/translationRoom'; export function createRoomEchoGuard(onChange) {
    let captures = 0;
    fixture.setEcho = active => { fixture.echo = active; onChange(active); };
    return { capture() { captures++; fixture.setEcho(true); let released = false; return () => { if (!released) { released = true; fixture.setEcho(--captures > 0); } }; }, isCapturing: () => Boolean(fixture.echo), dispose() {} };
  }`,
}
await build({
  stdin: { contents: "export { useTranslationRoom, useTranslationRoomStore } from './src/composables/useTranslationRoom'; export { playbackFocus } from './src/utils/playbackFocus'; export { useAuthStore } from '@/stores/useAuthStore'; export { fixture } from '@/services/translationRoom';", resolveDir: project },
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
const { useTranslationRoom, useTranslationRoomStore, useAuthStore, fixture, playbackFocus } = await import(pathToFileURL(resolve(temporary, 'session.mjs')).href)
const tick = () => new Promise(resolveTick => setImmediate(resolveTick))

function questionEvent(id: string, status = 'ready', audio = true) {
  return { type: 'question.updated', payload: { id, speakerId: '9223372036854775804', displayName: 'Alice',
    sourceLanguage: 'en', targetLanguage: 'zh-CN', source: 'Can we stop here?', text: '可以停车吗？',
    status, error: '', expiresAt: Date.now() + 120000, audio: audio ? [{ hex: 'aabb', format: 'mp3' }] : null } }
}

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
  fixture.frames = []; fixture.flushes = 0; fixture.stopHook = null; fixture.onFrame = null
  fixture.echo = false
  fixture.uploads = []; fixture.uploadPending = null
  setActivePinia(createPinia())
  const store = useTranslationRoomStore()
  context.after(async () => { await store.leave(false); store.$dispose() })
  return store
}

test('host waits for input pause acknowledgement, then plays visitor audio and can resume commentary', async context => {
  const store = setup(context)
  await store.create('zh-CN')
  const socket = fixture.sockets[0]
  socket.onopen()
  const start = store.startSpeaking(); await tick(); fixture.sockets[1].onopen(); await start
  socket.onmessage({ data: JSON.stringify(questionEvent('question-1')) })
  assert.equal(store.questions[0].status, 'ready')
  assert.equal(store.questionPlaying, false)
  const listen = store.listenQuestions()
  await tick()
  assert.equal(store.speaking, false)
  assert.equal(store.questionPlaying, false)
  assert.equal(JSON.parse(fixture.sockets[1].sent.at(-1)).type, 'input.pause')
  assert.equal(fixture.requests.some((request: any) => /\/(end|close)$/.test(request.path)), false)
  socket.onmessage({ data: JSON.stringify({ type: 'input.paused' }) })
  await listen; await tick()
  assert.equal(store.questionPlaying, true)
  assert.equal(store.questions[0].status, 'playing')
  fixture.played.at(-1).onended()
  await tick()
  assert.equal(store.questions[0].status, 'played')
  assert.equal(store.questionPlaying, false)
  const resume = store.startSpeaking(); await tick(); fixture.sockets[2].onopen(); await resume
  assert.equal(store.speaking, true)
  assert.equal(socket.closed, false)
})

test('continuous tour owns guest audio while room subtitles stay live and mute remains an explicit preference', async context => {
  const store = setup(context)
  await store.join('12345678', 'en')
  const socket = fixture.sockets[0]; socket.onopen()
  store.setContinuousAudio(true)
  assert.equal(store.muted, false)
  socket.onmessage({ data: JSON.stringify({ type: 'subscription.ready', targetLanguage: 'en', payload: { room: store.room } }) })
  socket.onmessage({ data: JSON.stringify({ type: 'translation.final', targetLanguage: 'en', payload: { text: 'Current commentary' } }) })
  socket.onmessage({ data: JSON.stringify({ type: 'audio.delta', targetLanguage: 'en', payload: { audio: 'AAAA' } }) })
  socket.onmessage({ data: JSON.stringify({ type: 'audio.done', targetLanguage: 'en', payload: {} }) })
  await tick()
  assert.equal(store.translated, 'Current commentary')
  assert.equal(store.audioError, '')
  assert.equal(fixture.played.length, 1)
  await store.toggleMute()
  assert.equal(store.muted, true)
  await store.toggleMute()
  assert.equal(store.muted, false)
  assert.equal(fixture.played.length, 1)
})

test('immediate dismissal stops audio and disables following without an error message', async context => {
  const store = setup(context)
  await store.join('12345678', 'zh')
  const socket = fixture.sockets[0]; socket.onopen()
  store.error = '请先加入房间'
  socket.onmessage({ data: JSON.stringify({ type: 'room.closed', payload: { mode: 'immediate' } }) })
  assert.equal(store.room.status, 'closed')
  assert.equal(store.following, false)
  assert.equal(store.listening, false)
  assert.equal(store.connected, false)
  assert.equal(store.error, '')
  assert.equal(store.displayNotice, '车夫已解散房间')
})

test('room recovery rejoins the original room once and preserves mute and follow preferences', async context => {
  const store = setup(context)
  await store.join('12345678', 'en')
  store.muted = true
  store.following = false
  let resolve!: (value: unknown) => void
  fixture.pending = new Promise(done => { resolve = done })
  const first = store.recoverRoom(store.room.roomId), second = store.recoverRoom(store.room.roomId)
  assert.equal(fixture.requests.filter((entry: any) => entry.path === '/join').length, 2)
  resolve({ ...store.room, status: 'live' })
  assert.equal(await first, true)
  assert.equal(await second, true)
  assert.equal(store.muted, true)
  assert.equal(store.following, false)
  assert.equal(store.recovering, false)
  assert.equal(fixture.requests.at(-1).data.targetLanguage, 'en')
})

test('room recovery distinguishes confirmed dismissal from unrelated permission failure', async context => {
  const store = setup(context)
  await store.join('12345678', 'zh')
  fixture.pending = Promise.reject(Error('无权加入此房间'))
  await assert.rejects(store.recoverRoom(store.room.roomId), /无权加入/)
  assert.notEqual(store.room.status, 'closed')
  fixture.pending = Promise.reject(Object.assign(Error('房间已结束，不能继续加入或输入'), { statusCode: 400 }))
  assert.equal(await store.recoverRoom(store.room.roomId), false)
  assert.equal(store.room.status, 'closed')
  assert.equal(store.displayNotice, '车夫已解散房间')
  assert.equal(store.error, '')
})

test('room recovery cannot restore a room dismissed while the join response was in flight', async context => {
  const store = setup(context)
  await store.join('12345678', 'zh')
  const original = { ...store.room }
  let resolve!: (value: unknown) => void
  fixture.pending = new Promise(done => { resolve = done })
  const recovering = store.recoverRoom(original.roomId)
  store.finishRoom()
  resolve(original)
  assert.equal(await recovering, false)
  assert.equal(store.room.status, 'closed')
  assert.equal(store.following, false)
  assert.equal(store.displayNotice, '车夫已解散房间')
})

test('visitor short recording uploads one WAV with string identifiers and cancels cleanly', async context => {
  const store = setup(context)
  await store.join('12345678', 'en')
  const socket = fixture.sockets[0]; socket.onopen()
  socket.onmessage({ data: JSON.stringify({ type: 'subscription.ready', targetLanguage: 'en', payload: { room: { ...store.room, guestSpeechEnabled: true } } }) })
  store.startQuestion(); await tick()
  assert.equal(store.questionRecording, true)
  assert.equal(fixture.echo, true)
  fixture.onFrame(new Float32Array(16000))
  store.stopQuestion(); await tick(); await tick()
  assert.equal(fixture.uploads.length, 1)
  assert.equal(fixture.uploads[0].roomId, '9223372036854775805')
  assert.match(fixture.uploads[0].requestId, /^[a-f0-9]{32}$/)
  assert.equal(new TextDecoder().decode(fixture.uploads[0].wav.slice(0, 4)), 'RIFF')
  assert.equal(store.questionRecording, false)
  assert.equal(store.questionUploading, false)
  assert.equal(fixture.echo, false)
  store.startQuestion(); await tick(); fixture.onFrame(new Float32Array(16000)); store.cancelQuestion(); await tick()
  assert.equal(fixture.uploads.length, 1)
  assert.equal(store.questionRecording, false)
})

test('late microphone permission after leaving is stopped without uploading or changing a new room', async context => {
  const store = setup(context)
  await store.join('12345678', 'en')
  fixture.sockets[0].onopen()
  store.room = { ...store.room, guestSpeechEnabled: true }
  let finish: (mic: any) => void = () => {}
  fixture.microphone = new Promise(resolve => { finish = resolve })
  store.startQuestion(); await tick()
  await store.leave(false)
  let stopped = 0
  finish({ async stop(options: any) { assert.equal(options.flush, false); stopped++ } })
  await tick(); await tick()
  assert.equal(stopped, 1)
  assert.equal(store.room, null)
  assert.equal(store.questionRecording, false)
  assert.equal(fixture.uploads.length, 0)
})

test('question audio uses its own message stream and is cleared when disconnected or interrupted', async context => {
  const store = setup(context)
  await store.create('zh-CN'); const socket = fixture.sockets[0]; socket.onopen()
  socket.onmessage({ data: JSON.stringify(questionEvent('q-1')) })
  socket.onmessage({ data: JSON.stringify(questionEvent('q-2')) })
  assert.equal(store.questions.length, 2)
  assert.equal(store.feed.length, 0)
  await store.listenQuestions(); await tick()
  assert.equal(store.questions[0].status, 'playing')
  const ask = playbackFocus.channel('ask', () => {}); ask.claim()
  assert.equal(store.questionPlaying, false)
  assert.equal(store.questions[0].status, 'ready')
  ask.release()
  await store.listenQuestions(); await tick()
  fixture.played.at(-1).onended(); await tick(); await tick()
  assert.equal(store.questions[0].status, 'played')
  assert.equal(store.questions[1].status, 'playing')
  socket.onclose()
  assert.equal(store.questionPlaying, false)
  assert.equal(store.questions[1].status, 'expired')
  assert.equal(store.questions.some((item: any) => item.audioAvailable), false)
})

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

test('ending the host input sends the last captured frame and PCM flush before input.end', async context => {
  const store = setup(context)
  await store.create('zh-CN')
  const starting = store.startSpeaking()
  await tick()
  const socket = fixture.sockets.at(-1)
  socket.onopen()
  await starting
  fixture.stopHook = async (options: { flush: boolean }) => {
    assert.equal(options.flush, true)
    fixture.onFrame(new Float32Array(128))
  }
  await store.end(false)
  assert.deepEqual(fixture.frames, [128])
  assert.equal(fixture.flushes, 1)
  assert.deepEqual(socket.sent.map((value: ArrayBuffer | string) => typeof value === 'string' ? JSON.parse(value).type : value.byteLength), [256, 4, 'input.end'])
  assert.equal(socket.closed, false)
})

test('leaving the room discards delayed frames without flushing or sending input.end', async context => {
  const store = setup(context)
  await store.create('zh-CN')
  const starting = store.startSpeaking()
  await tick()
  const socket = fixture.sockets.at(-1)
  socket.onopen()
  await starting
  fixture.stopHook = async (options: { flush: boolean }) => {
    assert.equal(options.flush, false)
    fixture.onFrame(new Float32Array(128))
  }
  await store.leave(false)
  assert.deepEqual(fixture.frames, [])
  assert.equal(fixture.flushes, 0)
  assert.deepEqual(socket.sent, [])
  assert.equal(socket.closed, true)
})

test('account switch while draining the microphone cancels the previous input tail', async context => {
  const store = setup(context)
  await store.create('zh-CN')
  const starting = store.startSpeaking()
  await tick()
  const socket = fixture.sockets.at(-1)
  socket.onopen()
  await starting
  let finish!: () => void
  fixture.stopHook = () => new Promise<void>(resolveStop => { finish = resolveStop })
  const ending = store.end(false)
  await tick()
  useAuthStore().profile = null
  fixture.onFrame(new Float32Array(128))
  finish()
  await ending
  assert.deepEqual(fixture.frames, [])
  assert.equal(fixture.flushes, 0)
  assert.deepEqual(socket.sent, [])
  assert.equal(socket.closed, true)
})

test('a delayed previous capture stop cannot release the new host input audio focus', async context => {
  const store = setup(context)
  await store.create('zh-CN')
  let starting = store.startSpeaking()
  await tick()
  fixture.sockets.at(-1).onopen()
  await starting
  let finish!: () => void
  fixture.stopHook = () => new Promise<void>(resolveStop => { finish = resolveStop })
  const leaving = store.leave(false)
  await store.create('zh-CN')
  starting = store.startSpeaking()
  await tick()
  const socket = fixture.sockets.at(-1)
  socket.onopen()
  await starting
  fixture.stopHook = null
  finish()
  await leaving
  assert.equal(playbackFocus.current(), 'room')
  assert.equal(store.speaking, true)
  assert.equal(socket.closed, false)
})

test('ASR capacity pause stops host capture without disconnecting room events or flushing a rejected tail', async context => {
  const store = setup(context)
  await store.create('zh-CN')
  const starting = store.startSpeaking()
  await tick()
  const socket = fixture.sockets.at(-1)
  socket.onopen()
  await starting
  fixture.sockets[0].onmessage({ data: JSON.stringify({ type: 'segment.error', payload: { code: 'asr_capacity_exceeded', message: '识别积压已达上限' } }) })
  await tick()
  assert.equal(store.speaking, false)
  assert.equal(socket.closed, true)
  assert.equal(fixture.sockets[0].closed, false)
  assert.equal(fixture.flushes, 0)
  assert.match(store.error, /积压/)
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

test('local host microphone stops queued visitor audio and resumes at a fresh segment without replaying echo', async context => {
  const store = setup(context)
  await store.join('12345678', 'en')
  const socket = fixture.sockets[0]
  const emit = (type: string, payload: object = {}, sequence = 1) => socket.onmessage({ data: JSON.stringify({ type, targetLanguage: 'en', sequence, payload }) })
  emit('subscription.ready', { room: store.room })
  emit('translation.committed', { text: '你好' })
  emit('audio.delta', { audio: 'aabb', isFinal: true })
  await tick()
  const playing = fixture.played.at(-1)
  assert.equal(playing.stopped, false)
  fixture.setEcho(true)
  assert.equal(playing.stopped, true)
  assert.equal(store.echoSuppressed, true)
  assert.match(store.audioNotice, /prevent echo/)
  const count = fixture.played.length
  emit('audio.started', { format: 'mp3' })
  emit('audio.delta', { audio: 'aabb', isFinal: true })
  emit('translation.final', { text: 'Hello' })
  await tick()
  assert.equal(store.feed[0].text, 'Hello')
  assert.equal(fixture.played.length, count)
  fixture.setEcho(false)
  emit('audio.delta', { audio: 'aabb', isFinal: true })
  emit('audio.done')
  await tick()
  assert.equal(fixture.played.length, count)
  emit('translation.committed', { text: '下一段' }, 2)
  emit('audio.started', { format: 'mp3' }, 2)
  emit('audio.delta', { audio: 'aabb', isFinal: true }, 2)
  await tick()
  assert.equal(fixture.played.length, count + 1)
  assert.equal(store.echoSuppressed, false)
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

test('paused room discards live audio and resumes only at the next complete segment boundary', async context => {
  const store = setup(context)
  await store.join('12345678', 'en')
  const socket = fixture.sockets[0]
  const emit = (type: string, payload: object = {}) => socket.onmessage({ data: JSON.stringify({ type, targetLanguage: 'en', payload }) })
  emit('subscription.ready', { room: store.room })
  emit('translation.committed', { text: '你好' })
  emit('audio.started', { format: 'mp3' })
  emit('audio.delta', { audio: 'aabb', isFinal: true })
  await tick()
  const previous = fixture.played.at(-1)
  await store.toggleMute()
  assert.equal(previous.stopped, true)
  assert.equal(store.muted, true)
  const played = fixture.played.length
  emit('translation.committed', { text: '暂停期间' })
  emit('audio.started', { format: 'mp3' })
  emit('audio.delta', { audio: 'ccdd', isFinal: true })
  await tick()
  assert.equal(fixture.played.length, played)
  assert.equal(store.audioReceived, true)
  await store.toggleMute()
  const resumed = fixture.played.length
  emit('audio.delta', { audio: 'eeff', isFinal: true })
  emit('audio.done')
  await tick()
  assert.equal(fixture.played.length, resumed)
  emit('translation.committed', { text: '下一段' })
  emit('audio.started', { format: 'mp3' })
  emit('audio.delta', { audio: 'aabb', isFinal: true })
  await tick()
  assert.equal(fixture.played.length, resumed + 1)
  assert.equal(store.audioError, '')
})

test('private ask pauses room audio while retaining subtitles and manual resume interrupts the ask', async context => {
  const store = setup(context)
  await store.join('12345678', 'en')
  const socket = fixture.sockets[0]
  socket.onmessage({ data: JSON.stringify({ type: 'subscription.ready', targetLanguage: 'en', payload: { room: store.room } }) })
  let stopped = 0
  const ask = playbackFocus.channel('ask', () => { stopped++ })
  ask.claim()
  assert.equal(store.muted, true)
  assert.equal(store.listening, true)
  assert.equal(socket.closed, false)
  socket.onmessage({ data: JSON.stringify({ type: 'translation.final', targetLanguage: 'en', payload: { text: 'Still receiving text' } }) })
  assert.equal(store.feed[0].text, 'Still receiving text')
  assert.equal(store.audioError, '')
  await store.toggleMute()
  assert.equal(stopped, 1)
  assert.equal(playbackFocus.current(), 'room')
})

test('a guest cannot open an input socket and switching audio focus releases the host microphone', async context => {
  const store = setup(context)
  await store.join('12345678', 'en')
  await store.startSpeaking()
  assert.equal(fixture.sockets.some((socket: any) => socket.channel === 'input'), false)
  await store.leave(false)
  await store.create('zh-CN')
  const starting = store.startSpeaking()
  await tick()
  fixture.sockets.at(-1).onopen()
  await starting
  assert.equal(store.speaking, true)
  const tour = playbackFocus.channel('tour', () => {})
  tour.claim()
  await tick()
  assert.equal(store.speaking, false)
  assert.equal(fixture.stops, 1)
  assert.equal(fixture.sockets.at(-1).closed, true)
  tour.release()
})

test('a new successful segment clears the previous speech failure', async context => {
  const store = setup(context)
  await store.join('12345678', 'en')
  const socket = fixture.sockets[0]
  const emit = (type: string, payload: object) => socket.onmessage({ data: JSON.stringify({ type, targetLanguage: 'en', payload }) })
  emit('subscription.ready', { room: store.room })
  emit('audio.error', { message: '语音合成暂时不可用' })
  assert.notEqual(store.audioError, '')
  emit('translation.committed', { text: '下一段' })
  emit('audio.started', { format: 'mp3' })
  emit('audio.delta', { audio: 'aabb', isFinal: true })
  emit('translation.final', { text: 'Next segment' })
  await tick()
  assert.equal(store.audioError, '')
  assert.equal(store.error, '')
  assert.equal(store.muted, false)
})
