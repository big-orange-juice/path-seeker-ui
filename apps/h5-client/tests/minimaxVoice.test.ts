import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdtemp, rm } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const require = createRequire(import.meta.url)
const { build } = createRequire(require.resolve('vite'))('esbuild')
const project = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const temporary = await mkdtemp(resolve(project, 'tests/.runtime-'))
after(async () => { await rm(temporary, { recursive: true, force: true }) })
await build({
  stdin: { contents: `export { useMinimaxVoiceRecognition } from './src/composables/useMinimaxVoiceRecognition'; export { setAccessToken } from './src/services/authSession';`, resolveDir: project },
  bundle: true, platform: 'node', format: 'esm', outfile: resolve(temporary, 'voice.mjs'),
  external: ['vue'], alias: { '@': resolve(project, 'src') },
  define: { 'import.meta.env.BASE_URL': '"/client/"', 'import.meta.env.VITE_API_BASE_URL': '"https://fixture.test/api/"' },
})
const { useMinimaxVoiceRecognition, setAccessToken } = await import(pathToFileURL(resolve(temporary, 'voice.mjs')).href)
const tick = () => new Promise<void>(done => setImmediate(done))

function setup(context: any) {
  const previousWindow = globalThis.window
  const previousWorklet = globalThis.AudioWorkletNode
  const previousNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
  const nodes: any[] = []
  const contexts: any[] = []
  const streams: any[] = []
  const requests: Array<{ url: string; options: RequestInit }> = []
  let media: () => Promise<any> = async () => {
    const track = { stops: 0, stop() { this.stops += 1 } }
    const stream = { track, getTracks: () => [track] }
    streams.push(stream)
    return stream
  }
  let response: (options: RequestInit) => Promise<Response> = async () => Response.json({ code: 0, data: { text: '这里有什么历史？' } })
  const connectable = () => ({ connect(next: any) { return next }, disconnect() {} })
  class FakeAudioContext {
    sampleRate = 48000
    state = 'suspended'
    destination = {}
    modulePaths: string[] = []
    audioWorklet = { addModule: async (path: string) => { this.modulePaths.push(path) } }
    constructor() { contexts.push(this) }
    resume() { this.state = 'running'; return Promise.resolve() }
    close() { this.state = 'closed'; return Promise.resolve() }
    createMediaStreamSource() { return connectable() }
    createGain() { return { ...connectable(), gain: { value: 1 } } }
  }
  class FakeWorklet {
    port = { onmessage: null as null | ((event: any) => void), close() {} }
    constructor() { nodes.push(this) }
    connect(next: any) { return next }
    disconnect() {}
  }
  Object.assign(globalThis, { window: { isSecureContext: true, AudioContext: FakeAudioContext }, AudioWorkletNode: FakeWorklet })
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { userAgent: 'fixture', mediaDevices: { getUserMedia: () => media() } } })
  context.mock.method(globalThis, 'fetch', async (url: string, options: RequestInit) => {
    requests.push({ url, options })
    return response(options)
  })
  const voice = useMinimaxVoiceRecognition()
  voice.abort()
  setAccessToken('fixture-token')
  context.after(() => {
    voice.abort()
    Object.assign(globalThis, { window: previousWindow, AudioWorkletNode: previousWorklet })
    if (previousNavigator) Object.defineProperty(globalThis, 'navigator', previousNavigator)
    else Reflect.deleteProperty(globalThis, 'navigator')
  })
  const record = async () => {
    assert.equal(voice.start(), true)
    await tick()
    assert.equal(voice.listening.value, true)
    nodes.at(-1).port.onmessage({ data: new Float32Array(48000).fill(0.5) })
  }
  return { voice, record, contexts, streams, nodes, requests,
    media: (value: typeof media) => { media = value }, response: (value: typeof response) => { response = value } }
}

test('三个入口共享唯一控制器，松手只上传一次，WAV 为16k单声道16位PCM', async context => {
  const fixture = setup(context)
  const { voice, record, requests, contexts, streams } = fixture
  assert.equal(voice, useMinimaxVoiceRecognition())
  await record()
  assert.equal(voice.start(), false)
  const first = voice.stop()
  assert.equal(voice.stop(), first)
  assert.equal(await first, '这里有什么历史？')
  assert.equal(requests.length, 1)
  assert.equal(requests[0].url, 'https://fixture.test/api/ExhibitChat/transcribe')
  assert.equal((requests[0].options.headers as any).Authorization, 'Bearer fixture-token')
  assert.equal('Content-Type' in (requests[0].options.headers as any), false)
  const file = (requests[0].options.body as FormData).get('file') as File
  const bytes = await file.arrayBuffer()
  const view = new DataView(bytes)
  assert.equal(new TextDecoder().decode(bytes.slice(0, 4)), 'RIFF')
  assert.equal(new TextDecoder().decode(bytes.slice(8, 12)), 'WAVE')
  assert.equal(view.getUint16(22, true), 1)
  assert.equal(view.getUint32(24, true), 16000)
  assert.equal(view.getUint16(34, true), 16)
  assert.equal(view.getUint32(40, true), 32000)
  assert.equal(view.getInt16(44, true), 16383)
  assert.equal(voice.busy.value, false)
  assert.equal(streams[0].track.stops, 1)
  assert.equal(contexts[0].state, 'closed')
  assert.deepEqual(contexts[0].modulePaths, ['/client/worklets/voice-recording.worklet.js'])
})

test('短录音立即结束等待，不上传且允许重试', async context => {
  const { voice, requests } = setup(context)
  voice.start()
  await tick()
  assert.equal(await voice.stop(), '')
  assert.equal(requests.length, 0)
  assert.equal(voice.errorCode.value, 'record-too-short')
  assert.equal(voice.busy.value, false)
  assert.equal(voice.start(), true)
})

test('授权尚未完成时松手立即返回，迟到轨道被释放', async context => {
  const fixture = setup(context)
  let done!: (value: any) => void
  fixture.media(() => new Promise(resolve => { done = resolve }))
  fixture.voice.start()
  assert.equal(await fixture.voice.stop(), '')
  assert.equal(fixture.voice.busy.value, false)
  let stopped = 0
  done({ getTracks: () => [{ stop() { stopped += 1 } }] })
  await tick()
  assert.equal(stopped, 1)
  assert.equal(fixture.requests.length, 0)
})

test('取消旧授权后开始新录音，旧回调不会停止新轨道或清空新状态', async context => {
  const fixture = setup(context)
  let done!: (value: any) => void
  fixture.media(() => new Promise(resolve => { done = resolve }))
  fixture.voice.start()
  fixture.voice.abort()
  let freshStops = 0
  fixture.media(async () => ({ getTracks: () => [{ stop() { freshStops += 1 } }] }))
  await fixture.record()
  let oldStops = 0
  done({ getTracks: () => [{ stop() { oldStops += 1 } }] })
  await tick()
  assert.equal(oldStops, 1)
  assert.equal(freshStops, 0)
  assert.equal(fixture.voice.listening.value, true)
  assert.equal(await fixture.voice.stop(), '这里有什么历史？')
})

test('上传取消后迟到结果不污染新一轮，也不解除新一轮busy状态', async context => {
  const fixture = setup(context)
  let done!: (value: Response) => void
  fixture.response(() => new Promise(resolve => { done = resolve }))
  await fixture.record()
  const old = fixture.voice.stop()
  fixture.voice.abort()
  assert.equal(await old, '')
  await fixture.record()
  done(Response.json({ code: 0, data: { text: '旧问题' } }))
  await tick()
  assert.equal(fixture.voice.finalText.value, '')
  assert.equal(fixture.voice.listening.value, true)
  assert.equal(fixture.voice.busy.value, true)
})

for (const [name, payload, status, message] of [
  ['HTTP失败', { message: '服务暂时不可用' }, 503, '服务暂时不可用'],
  ['HTTP200业务错误', { code: 10001, message: '请求失败' }, 200, '请求失败'],
  ['空识别文本', { code: 0, data: { text: '' } }, 200, '没有识别到内容'],
] as const) {
  test(`${name}不会发送问题且可再次录音`, async context => {
    const fixture = setup(context)
    fixture.response(async () => Response.json(payload, { status }))
    await fixture.record()
    assert.equal(await fixture.voice.stop(), '')
    assert.ok(fixture.voice.error.value.includes(message))
    assert.equal(fixture.voice.busy.value, false)
    assert.equal(fixture.voice.start(), true)
  })
}

test('麦克风拒绝给出权限提示并释放AudioContext', async context => {
  const fixture = setup(context)
  fixture.media(async () => { throw new DOMException('', 'NotAllowedError') })
  fixture.voice.start()
  await tick()
  assert.equal(fixture.voice.errorCode.value, 'NotAllowedError')
  assert.equal(fixture.voice.busy.value, false)
  assert.equal(fixture.contexts[0].state, 'closed')
  assert.equal(fixture.requests.length, 0)
})

test('录音初始化超时释放占用，迟到授权结果不触发上传', async context => {
  const fixture = setup(context)
  context.mock.timers.enable({ apis: ['setTimeout'] })
  let done!: (value: any) => void
  fixture.media(() => new Promise(resolve => { done = resolve }))
  fixture.voice.start()
  context.mock.timers.tick(15000)
  assert.equal(fixture.voice.errorCode.value, 'record-start-timeout')
  assert.equal(fixture.voice.busy.value, false)
  let stopped = 0
  done({ getTracks: () => [{ stop() { stopped += 1 } }] })
  await tick()
  assert.equal(stopped, 1)
  assert.equal(fixture.requests.length, 0)
})

test('上传超时停止等待并允许再次提问', async context => {
  const fixture = setup(context)
  context.mock.timers.enable({ apis: ['setTimeout'] })
  fixture.response(options => new Promise((_resolve, reject) => {
    options.signal!.addEventListener('abort', () => reject(new DOMException('', 'AbortError')), { once: true })
  }))
  await fixture.record()
  const completion = fixture.voice.stop()
  context.mock.timers.tick(65000)
  assert.equal(await completion, '')
  assert.match(fixture.voice.error.value, /超时/)
  assert.equal(fixture.voice.busy.value, false)
  assert.equal(fixture.voice.start(), true)
})
