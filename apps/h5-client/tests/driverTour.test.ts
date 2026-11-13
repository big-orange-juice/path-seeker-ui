import test, { after, type TestContext } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdtemp, rm } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createRenderer, shallowRef, nextTick } from 'vue'

const require = createRequire(import.meta.url)
const { build } = createRequire(require.resolve('vite'))('esbuild')
const project = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const temporary = await mkdtemp(resolve(project, 'tests/.runtime-'))
after(() => rm(temporary, { recursive: true, force: true }))
await build({
  stdin: { contents: `export { useDriverTour } from './src/composables/useDriverTour'; export { useTourJourney } from './src/composables/useTourJourney';`, resolveDir: project },
  bundle: true, platform: 'node', format: 'esm', outfile: resolve(temporary, 'driver.mjs'), external: ['vue'],
  alias: { '@': resolve(project, 'src'), '@path-seeker/ts-shared': resolve(project, '../../packages/ts-shared/src/index.ts') },
  plugins: [{ name: 'driver-fixture', setup(builder: any) {
    builder.onResolve({ filter: /services\/(tourAudioApi|authSession|clientCatalog)$/ }, (args: any) => ({ path: args.path.split('/').at(-1), namespace: 'fixture' }))
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, (args: any) => ({ contents: args.path === 'authSession'
      ? `export const getAccessToken = () => 'account-a';`
      : args.path === 'tourAudioApi' ? `export const tourAudioMediaUrl = path => 'https://example.test/api' + path; export const tourAudioRequest = (...args) => globalThis.driverFixture.request(...args);`
        : `export const fetchClientCatalog = async () => ({}); export const fetchClientTour = async () => ({}); export const fetchActiveRouteVisit = async () => null;
          export const abandonRouteVisit = async () => {}; export const startRouteVisit = async () => globalThis.driverFixture.visit;
          export const updateRouteVisitStop = async (...args) => { globalThis.driverFixture.visitWrites.push(args); return globalThis.driverFixture.visit; };` }))
  } }],
})
const { useDriverTour, useTourJourney } = await import(pathToFileURL(resolve(temporary, 'driver.mjs')).href)
const tick = async () => { await new Promise(resolve => setImmediate(resolve)); await nextTick() }

function setup(context: TestContext) {
  const globals = Object.fromEntries(['navigator', 'window', 'document', 'Audio', 'localStorage', 'driverFixture'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
  const requests: { path: string; method: string; data?: any }[] = []
  const media: Media[] = []
  let gpsRequests = 0, revision = 0
  const visit = { visitId: '2121122456927342592', routeId: '2116113373455323136', locale: 'zh', status: 1, currentStageId: 'stage-a', completedStageIds: [] }
  let state: any = { sessionId: 'session-a', streamId: '', status: 'created', revision: 0, visitId: visit.visitId, routeId: visit.routeId,
    stageId: 'stage-a', itemId: 'chapter-a', itemTitle: '节点 A', itemTimeSeconds: 0, itemDurationSeconds: 60,
    mediaTimeSeconds: 0, paused: false, held: false, roomAudioPlaying: false, queue: [], visit, timeline: [], error: null }
  let position: any = { roomId: '396571645583691776', status: 'online', coordinateSystem: 'GCJ-02', longitude: 116.383, latitude: 39.937,
    accuracy: 5, sampledAt: new Date().toISOString(), serverTime: new Date().toISOString() }
  let createResponse: Promise<any> | null = null
  class Media {
    src = ''; paused = true; currentTime = 0; duration = 60; readyState = 1
    onplay: (() => void) | null = null; onplaying: (() => void) | null = null; onpause: (() => void) | null = null
    constructor(source?: string) { this.src = source || ''; media.push(this) }
    play() { this.paused = false; this.onplay?.(); this.onplaying?.(); return Promise.resolve() }
    pause() { const changed = !this.paused; this.paused = true; if (changed) this.onpause?.() }
    removeAttribute() { this.src = '' }; load() {}; addEventListener() {}; remove() {}
  }
  const storage = { getItem: () => null, setItem() {}, removeItem() {} }
  const fixture = { visit, visitWrites: [] as any[], request: async (path: string, method: string, data?: any) => {
    requests.push({ path, method, data })
    if (method === 'DELETE') return null
    if (path.endsWith('/location')) return position
    if (path === '/TourAudioSessions') return createResponse || { sessionId: 'session-a', mediaUrl: '/TourAudioSessions/session-a/media.mp3?ticket=x', state }
    if (data?.command === 'realign') state = { ...state, stageId: null, itemId: null, queue: [], timeline: [] }
    if (data?.command === 'pause') state = { ...state, paused: true }
    if (data?.command === 'resume') state = { ...state, paused: false }
    if (data?.command === 'hold') state = { ...state, held: true }
    if (data?.command === 'release') state = { ...state, held: false }
    return { ...state, revision: ++revision }
  } }
  const document = { visibilityState: 'visible' }
  for (const [key, value] of Object.entries({ Audio: Media, window: { speechSynthesis: undefined, sessionStorage: storage }, document,
    localStorage: storage, driverFixture: fixture, navigator: { geolocation: { watchPosition() { gpsRequests++; return 1 }, clearWatch() {} } } })) {
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  }
  const room: any = { room: shallowRef({ roomId: '396571645583691776', code: '12345678', isHost: false, status: 'live' }),
    following: shallowRef(true), continuousAudio: shallowRef(false), connected: shallowRef(true), recovering: shallowRef(false),
    muted: shallowRef(false), displayNotice: shallowRef(''), recoverRoom: async () => true,
    setContinuousAudio(value: boolean) { room.continuousAudio.value = value },
    finishRoom() { room.room.value = { ...room.room.value, status: 'closed' }; room.following.value = false; room.displayNotice.value = '车夫已解散房间' } }
  const asking = shallowRef(false)
  const renderer = createRenderer({ createElement: () => ({}), insert() {}, remove() {}, createText: () => ({}), createComment: () => ({}), setText() {}, setElementText() {}, parentNode: () => null, nextSibling: () => null, patchProp() {} })
  let journey: any, driver: any
  const app = renderer.createApp({ setup() { journey = useTourJourney(); driver = useDriverTour(journey, room, asking); return () => null } })
  app.mount({})
  context.after(() => {
    app.unmount()
    for (const [key, descriptor] of Object.entries(globals)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else Reflect.deleteProperty(globalThis, key)
    }
  })
  const start = async () => {
    journey.preview.value = { route: { id: visit.routeId, locale: 'zh' }, stops: ['stage-a', 'stage-b'].map((id, index) => ({
      id, name: id, order: index + 1, extraAudios: [], guideNarrations: [{ id: `guide-${id}`, locale: 'zh', chapters: [{ id: `chapter-${id}`, order: 1, audioUrl: '/chapter.mp3', text: '讲解' }] }],
    })) }
    await journey.start(); await tick()
  }
  return { journey, driver, room, asking, requests, media, fixture, document, start, gpsRequests: () => gpsRequests,
    state: () => state, setState: (value: any) => { state = { ...state, ...value, revision: ++revision } },
    setPosition: (value: any) => { position = { ...position, ...value } }, setCreation: (value: Promise<any>) => { createResponse = value } }
}

test('following uses the server session and driver position without acquiring visitor GPS or a local audio queue', async context => {
  const fixture = setup(context)
  await fixture.start()
  assert.equal(fixture.journey.serverManaged.value, true)
  assert.equal(fixture.gpsRequests(), 0)
  assert.equal(fixture.media.length, 1)
  assert.match(fixture.media[0].src, /TourAudioSessions/)
  assert.equal(fixture.room.continuousAudio.value, true)
  assert.equal(fixture.driver.location.value.accuracy, 5)
  assert.equal(fixture.fixture.visitWrites.length, 0)
  await fixture.journey.selectStop(1)
  assert.equal(fixture.journey.drawerStop.value.id, 'stage-b')
  assert.equal(fixture.media.length, 1)
  assert.equal(fixture.fixture.visitWrites.length, 0)
})

test('reconnect follows the newly audible server node and preserves server progress without local completion writes', async context => {
  const fixture = setup(context)
  await fixture.start()
  fixture.driver.reconnect(); fixture.driver.reconnect()
  await tick(); await tick()
  assert.deepEqual(fixture.requests.filter(entry => entry.data?.command).map(entry => entry.data.command), ['realign', 'resume', 'reconnect'])
  fixture.setState({ streamId: 'stream-b', status: 'streaming', visit: { ...fixture.fixture.visit, visitedStageIds: ['stage-a', 'stage-b'] },
    timeline: [{ start: 0, end: 60, kind: 'route', stageId: 'stage-b', itemId: 'chapter-b', title: '节点 B', itemStart: 0, duration: 60 }], queue: [{ stageId: 'stage-b', status: 'playing' }] })
  fixture.driver.visibility(true)
  await tick()
  assert.equal(fixture.journey.currentStop.value.id, 'stage-b')
  assert.equal(fixture.driver.playback.value.audible.time, 0)
  assert.deepEqual(fixture.journey.visit.value.visitedStageIds, ['stage-a', 'stage-b'])
  assert.equal(fixture.fixture.visitWrites.length, 0)
})

test('room dismissal stops continuous audio and keeps the page in a normal ended state without starting local narration', async context => {
  const fixture = setup(context)
  await fixture.start()
  fixture.room.finishRoom()
  await tick()
  fixture.driver.reconnect()
  await tick()
  assert.equal(fixture.driver.playback.value.active, false)
  assert.equal(fixture.driver.playback.value.error, '')
  assert.equal(fixture.driver.status.value, '车夫已解散房间')
  assert.equal(fixture.media[0].paused, true)
  assert.equal(fixture.media.length, 1)
  assert.equal(fixture.gpsRequests(), 0)
})

test('turning following off releases the server stream and restores explicit local playback', async context => {
  const fixture = setup(context)
  await fixture.start()
  fixture.driver.toggleFollowing()
  await tick()
  assert.equal(fixture.journey.serverManaged.value, false)
  assert.equal(fixture.driver.playback.value.active, false)
  assert.equal(fixture.room.continuousAudio.value, false)
  fixture.journey.playCurrentStop()
  assert.equal(fixture.media.length, 2)
  assert.equal(fixture.media[1].src, '/chapter.mp3')
})

test('stale driver locations do not fall back to visitor GPS or trigger local playback', async context => {
  const fixture = setup(context)
  fixture.setPosition({ sampledAt: new Date(Date.now() - 60000).toISOString() })
  await fixture.start()
  assert.equal(fixture.driver.location.value, null)
  assert.equal(fixture.driver.locationNotice.value, '正在等待车夫位置')
  assert.equal(fixture.gpsRequests(), 0)
  assert.equal(fixture.fixture.visitWrites.length, 0)
})

test('a question started during session creation prevents late route audio from starting', async context => {
  const fixture = setup(context)
  let resolve!: (value: unknown) => void
  fixture.setCreation(new Promise(done => { resolve = done }))
  await fixture.start()
  fixture.asking.value = true
  resolve({ sessionId: 'session-a', mediaUrl: '/TourAudioSessions/session-a/media.mp3?ticket=x', state: fixture.state() })
  await tick(); await tick()
  assert.equal(fixture.media.length, 0)
  assert.equal(fixture.driver.playback.value.held, true)
})
