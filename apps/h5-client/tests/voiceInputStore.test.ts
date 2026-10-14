import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdtemp, rm } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createPinia, setActivePinia } from 'pinia'

const require = createRequire(import.meta.url)
const { build } = createRequire(require.resolve('vite'))('esbuild')
const project = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const temporary = await mkdtemp(resolve(project, 'tests/.runtime-'))
after(async () => { await rm(temporary, { recursive: true, force: true }) })
const fixtures: Record<string, string> = {
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
  entryPoints: [resolve(project, 'src/stores/useAskStore.ts')],
  bundle: true, platform: 'node', format: 'esm', outdir: temporary, outExtension: { '.js': '.mjs' },
  external: ['vue', 'pinia', 'uuid'], alias: { '@': resolve(project, 'src') },
  define: { 'import.meta.env.VITE_API_BASE_URL': '"https://fixture.test/api"', 'import.meta.env.BASE_URL': '"/client/"' },
  plugins: [{ name: 'voice-fixture', setup(builder: any) {
    builder.onResolve({ filter: /^@\// }, (args: { path: string }) => fixtures[args.path] ? { path: args.path, namespace: 'fixture' } : undefined)
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, (args: { path: string }) => ({ contents: fixtures[args.path] }))
  } }],
})
const { useAskStore } = await import(pathToFileURL(resolve(temporary, 'useAskStore.mjs')).href)

function setup(testContext: any) {
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
  testContext.after(() => {
    store.$dispose()
    Object.assign(globalThis, { document: previousDocument })
  })
  return { store, completion, resolveText, requests, fakeDocument }
}

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
