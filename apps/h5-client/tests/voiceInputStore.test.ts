import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdtemp, rm } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'

const require = createRequire(import.meta.url)
const { build } = createRequire(require.resolve('vite'))('esbuild')
const project = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const temporary = await mkdtemp(resolve(project, 'tests/.runtime-'))
after(async () => { await rm(temporary, { recursive: true, force: true }) })
const fixtures: Record<string, string> = {
  '@/composables/useMinimaxVoiceRecognition': `
    import { shallowRef } from 'vue';
    export const voice = {
      supported: shallowRef(true), busy: shallowRef(false), listening: shallowRef(false),
      error: shallowRef(''), errorCode: shallowRef(''),
      starts: 0, stops: 0, aborts: 0, completion: Promise.resolve(''),
      start() { this.starts++; this.busy.value = true; this.error.value = ''; return true; },
      stop() { this.stops++; return this.completion; },
      abort() { this.aborts++; this.busy.value = false; this.listening.value = false; },
    };
    export const useMinimaxVoiceRecognition = () => voice;
  `,
  '@/services/exhibitChat': `
    export const createExhibitChatSession = async () => ({ id: 'session' });
    export const fetchExhibitChatHistory = async () => [];
    export const buildExhibitChatSendHeaders = () => ({});
    export const buildExhibitChatSendUrl = () => 'https://fixture.test/send';
    export const buildExhibitChatSendWithAudioUrl = buildExhibitChatSendUrl;
    export const mapExhibitChatLocationItems = value => value;
    export const mapExhibitChatSource = value => value;
  `,
  '@/services/http': 'export const resolveRequestErrorMessage = (error, fallback) => error?.message || fallback;',
  '@/utils/askVoice': "export const getDefaultAskVoiceId = () => 'voice';",
  '@/stores/useVenueStore': 'export const useVenueStore = () => ({ current: null });',
  '@/utils/askSpeechPlayer': `
    export const getSharedAskSpeechPlayer = () => ({
      getStatus: () => 'idle', getError: () => '', getProgress: () => ({ index: null, progress: 0 }),
      isBusy: () => false, subscribe: () => () => {}, stop() {}, unlock() {}, beginRun() {},
      enqueue() {}, finishRun() {}, configure() {},
    });
  `,
  '@/composables/usePlaybackBargeIn': `
    import { shallowRef } from 'vue';
    export const usePlaybackBargeIn = () => ({
      enabled: shallowRef(false), supported: shallowRef(false), armed: shallowRef(false),
      listening: shallowRef(false), permissionDenied: shallowRef(false), error: shallowRef(''),
      suspendCapture() {}, hold() {}, listen() {}, setEnabled() {}, arm: async () => false,
      hasPermission: async () => false,
    });
  `,
}
await build({
  stdin: { contents: "export { useAskStore } from './src/stores/useAskStore'; export { voice } from '@/composables/useMinimaxVoiceRecognition'; export { playbackFocus } from './src/utils/playbackFocus';", resolveDir: project },
  bundle: true, platform: 'node', format: 'esm', outfile: resolve(temporary, 'useAskStore.mjs'),
  external: ['vue', 'pinia', 'uuid'], alias: { '@': resolve(project, 'src') },
  define: { 'import.meta.env.VITE_API_BASE_URL': '"https://fixture.test/api"', 'import.meta.env.BASE_URL': '"/client/"' },
  plugins: [{ name: 'voice-fixture', setup(builder: any) {
    builder.onResolve({ filter: /^@\// }, (args: { path: string }) => fixtures[args.path] ? { path: args.path, namespace: 'fixture' } : undefined)
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, (args: { path: string }) => ({ contents: fixtures[args.path] }))
  } }],
})
const { useAskStore, voice, playbackFocus } = await import(pathToFileURL(resolve(temporary, 'useAskStore.mjs')).href)

function setup(testContext: any) {
  voice.abort()
  voice.error.value = ''
  voice.supported.value = true
  voice.starts = 0
  voice.stops = 0
  voice.aborts = 0
  const previousDocument = globalThis.document
  const fakeDocument = Object.assign(new EventTarget(), { visibilityState: 'visible' })
  Object.assign(globalThis, { document: fakeDocument })
  const requests: any[] = []
  testContext.mock.method(globalThis, 'fetch', async (_url: string, options: RequestInit) => {
    requests.push(JSON.parse(String(options.body)))
    return new Response('event: done\ndata: {"type":"done","payload":{}}\n\n')
  })
  setActivePinia(createPinia())
  const store = useAskStore()
  store.setStageContext({ routeId: 'route', stageId: 'stage', stageTitle: '烟袋斜街' })
  store.beginVoiceInput()
  let resolveText!: (text: string) => void
  const completion = new Promise<string>(resolve => { resolveText = resolve })
  voice.completion = completion
  testContext.after(() => {
    store.$dispose()
    Object.assign(globalThis, { document: previousDocument })
  })
  return { store, completion, resolveText, requests, fakeDocument }
}

test('房间恢复取得播放权时取消私人问答收音，迟到识别不会发送', async context => {
  const { store, resolveText, requests } = setup(context)
  store.startVoiceInput()
  const finishing = store.stopVoiceInput()
  assert.equal(store.voiceInputFinishing, true)
  const room = playbackFocus.channel('room', () => {})
  room.claim()
  assert.equal(store.voiceInputFinishing, false)
  assert.equal(store.voiceInputActive, false)
  resolveText('迟到的私人问题')
  await finishing
  assert.equal(requests.length, 0)
  assert.equal(playbackFocus.current(), 'room')
  room.release()
})

test('点击开启后持续收音，内容页再次点击只停止并发送一次', async testContext => {
  const { store, resolveText, requests } = setup(testContext)
  store.openAsk()
  assert.equal(store.startVoiceInput(), true)
  assert.equal(store.voiceInputActive, true)
  assert.equal(store.interactionMode, 'voice')
  assert.equal(store.startVoiceInput(), false)
  assert.equal(voice.starts, 1)
  store.closeAsk()
  assert.equal(store.voiceInputActive, true)
  const finishing = store.toggleVoiceInput()
  assert.equal(store.voiceInputActive, false)
  assert.equal(store.voiceInputFinishing, true)
  store.toggleVoiceInput()
  assert.equal(voice.stops, 1)
  assert.equal(voice.starts, 1)
  resolveText('开关式语音问题')
  await finishing
  assert.equal(requests.length, 1)
})

test('关闭收音后迟到的识别结果不发送，可再次开启', async testContext => {
  const { store, resolveText, requests } = setup(testContext)
  store.startVoiceInput()
  const finishing = store.stopVoiceInput()
  store.cancelVoiceInput()
  assert.equal(store.voiceInputActive, false)
  assert.equal(store.voiceInputFinishing, false)
  resolveText('取消后的问题')
  await finishing
  assert.equal(requests.length, 0)
  assert.equal(store.startVoiceInput(), true)
  store.cancelVoiceInput()
  assert.equal(voice.aborts, 2)
})

test('录音达到上限自动结束时仍识别发送，启动失败可重试', async testContext => {
  const { store, resolveText, requests } = setup(testContext)
  store.startVoiceInput()
  voice.error.value = '麦克风权限被拒绝'
  voice.busy.value = false
  await nextTick()
  assert.equal(store.voiceInputActive, false)
  assert.equal(store.startVoiceInput(), true)
  voice.listening.value = true
  await nextTick()
  voice.listening.value = false
  await nextTick()
  assert.equal(store.voiceInputFinishing, true)
  resolveText('自动结束的问题')
  await new Promise(done => setImmediate(done))
  assert.equal(requests.length, 1)
})

test('不支持收音时打开文字提问并提示原因', testContext => {
  const { store } = setup(testContext)
  voice.supported.value = false
  assert.equal(store.startVoiceInput(), false)
  assert.equal(store.voiceInputActive, false)
  assert.equal(store.interactionMode, 'text')
  assert.ok(store.errorMessage.includes('不支持语音输入'))
})

test('松手后问答 store 接管识别，页面关闭浮层标记不会取消自动发送', async (testContext) => {
  const { store, completion, resolveText, requests } = setup(testContext)
  const finishing = store.finishVoiceInput(completion)
  store.closeAsk()
  assert.equal(store.voiceInputFinishing, true)
  assert.equal(requests.length, 0)
  resolveText('为什么烟袋斜街是斜的？')
  await finishing
  assert.equal(store.voiceInputFinishing, false)
  assert.equal(requests.length, 1)
  assert.ok(requests[0].message.includes('为什么烟袋斜街是斜的？'))
  assert.equal(requests[0].stageId, 'stage')
  assert.equal(store.messages[0].content, '为什么烟袋斜街是斜的？')
})

test('Chat 等待识别时切后台，迟到内容不发送', async (testContext) => {
  const { store, completion, resolveText, requests, fakeDocument } = setup(testContext)
  const finishing = store.finishVoiceInput(completion)
  fakeDocument.visibilityState = 'hidden'
  fakeDocument.dispatchEvent(new Event('visibilitychange'))
  resolveText('不应发送的问题')
  await finishing
  assert.equal(store.voiceInputFinishing, false)
  assert.equal(requests.length, 0)
})

test('Chat 收到空识别结果时展示原因，仍可继续提问', async (testContext) => {
  const { store, completion, resolveText, requests } = setup(testContext)
  const finishing = store.finishVoiceInput(completion)
  resolveText('')
  await finishing
  assert.equal(store.voiceInputFinishing, false)
  assert.ok(store.errorMessage.includes('没有识别到内容'))
  assert.equal(requests.length, 0)
})
