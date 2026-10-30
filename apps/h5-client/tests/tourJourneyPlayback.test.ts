import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdtemp, rm } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createRenderer } from 'vue'

const require = createRequire(import.meta.url)
const { build } = createRequire(require.resolve('vite'))('esbuild')
const project = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const temporary = await mkdtemp(resolve(project, 'tests/.runtime-'))
after(async () => { await rm(temporary, { recursive: true, force: true }) })
await build({
  entryPoints: [resolve(project, 'src/composables/useTourJourney.ts')],
  bundle: true, platform: 'node', format: 'esm', outdir: temporary, outExtension: { '.js': '.mjs' },
  external: ['vue'], alias: { '@': resolve(project, 'src'), '@path-seeker/ts-shared': resolve(project, '../../packages/ts-shared/src/index.ts') },
  plugins: [{ name: 'catalog-fixture', setup(builder: any) {
    builder.onResolve({ filter: /services\/clientCatalog/ }, () => ({ path: 'catalog', namespace: 'fixture' }))
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: `
      export const fetchClientCatalog = async () => ({});
      export const fetchClientTour = async () => ({});
      export const fetchActiveRouteVisit = async () => null;
      export const abandonRouteVisit = async () => {};
      export const startRouteVisit = async () => ({ id: 'visit', routeId: 'route', currentStageId: 'stage-0', status: 1, completedStageIds: [] });
      export const updateRouteVisitStop = async (visit, stageId, action) => ({ ...visit, currentStageId: stageId, completedStageIds: action === 'complete' ? [...visit.completedStageIds, stageId] : visit.completedStageIds });
    ` }))
  } }],
})
const { useTourJourney } = await import(pathToFileURL(resolve(temporary, 'useTourJourney.mjs')).href)

test('手动观看视频保留解说断点，浏览其他节点时不会串用当前播放状态', async () => {
  const previous = { Audio: globalThis.Audio, window: globalThis.window, localStorage: globalThis.localStorage, document: globalThis.document }
  const saved = new Map<string, string>()
  const storage = { getItem: (key: string) => saved.get(key) ?? null, setItem: (key: string, value: string) => saved.set(key, value), removeItem: (key: string) => saved.delete(key) }
  class Media {
    tagName = 'AUDIO'; currentTime = 0; duration = 60; readyState = 1
    onplaying: (() => void) | null = null; onended: (() => void) | null = null
    play() { this.onplaying?.(); return Promise.resolve() }
    pause() {}; load() {}; removeAttribute() {}; remove() {}; addEventListener() {}
  }
  Object.assign(globalThis, { Audio: Media, window: { speechSynthesis: undefined, sessionStorage: storage }, localStorage: storage, document: { createElement: () => Object.assign(new Media(), { tagName: 'VIDEO' }), getElementById: () => ({ appendChild() {} }) } })
  const renderer = createRenderer({ createElement: () => ({}), insert() {}, remove() {}, createText: () => ({}), createComment: () => ({}), setText() {}, setElementText() {}, parentNode: () => null, nextSibling: () => null, patchProp() {} })
  let journey: any
  const app = renderer.createApp({ setup() { journey = useTourJourney(); return () => null } }); app.mount({})
  try {
    journey.preview.value = { route: { id: 'route', locale: 'zh' }, stops: [0, 1].map(index => ({
      id: `stage-${index}`, name: '本站', order: index + 1, video: '/stage.mp4', extraAudios: [],
      guideNarrations: [{ id: 'guide', locale: 'zh', chapters: [{ id: 'chapter', order: 1, text: '解说', audioUrl: '/chapter.mp3' }] }],
    })) }
    await journey.start(); await journey.selectStop(0)
    journey.playStopVideo()
    const key = 'path-seeker:tour-playback:route:stage-0'
    assert.equal(JSON.parse(saved.get(key)!).itemId, 'chapter')
    assert.equal(journey.speech.currentItem.value.mediaKind, 'video')
    journey.saveCheckpoint('page-hide')
    assert.equal(JSON.parse(saved.get(key)!).itemId, 'chapter')
    journey.playCurrentStop()
    journey.openContentDrawer(1, 'map-selection')
    journey.playStopVideo()
    assert.equal(journey.speech.currentItemId.value, 'chapter')
    journey.openContentDrawer(0, 'map-selection')
    journey.saveCheckpoint('manual')
    assert.equal(JSON.parse(saved.get(key)!).itemId, 'chapter')
  } finally { app.unmount(); Object.assign(globalThis, previous) }
})

test('近站定位需稳定停留，弱精度不入队，抑制结束后去重恢复且拒绝授权会停止监听', async () => {
  const previousNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
  const previousWindow = globalThis.window
  const previousStorage = globalThis.localStorage
  const originalNow = Date.now
  let now = 1800000000000
  Date.now = () => now
  const callbacks: Array<{ success: PositionCallback; error: PositionErrorCallback }> = []
  const cleared: number[] = []
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { geolocation: {
    watchPosition(success: PositionCallback, error: PositionErrorCallback) { callbacks.push({ success, error }); return callbacks.length },
    clearWatch(identifier: number) { cleared.push(identifier) },
  } } })
  Object.assign(globalThis, { window: { speechSynthesis: undefined }, localStorage: { getItem: () => null, setItem() {}, removeItem() {} } })
  const renderer = createRenderer({
    createElement: () => ({}), insert() {}, remove() {}, createText: () => ({}), createComment: () => ({}),
    setText() {}, setElementText() {}, parentNode: () => null, nextSibling: () => null, patchProp() {},
  })
  let journey: any
  const app = renderer.createApp({ setup() { journey = useTourJourney(); return () => null } })
  app.mount({})
  try {
    const nearbyId = '9223372036854775804'
    journey.preview.value = { route: { id: 'route', locale: 'zh' }, stops: [
      { id: 'stage-0', order: 1, name: '起点', longitude: 116, latitude: 39, extraAudios: [], guideNarrations: [] },
      { id: nearbyId, order: 2, name: '银锭桥', longitude: 116.383, latitude: 39.937, extraAudios: [], guideNarrations: [] },
    ] }
    await journey.start()
    journey.startTracking()
    const deliver = (accuracy: number) => callbacks[0]!.success({ coords: { longitude: 116.383, latitude: 39.937, accuracy, heading: null }, timestamp: now } as GeolocationPosition)
    deliver(200)
    now += 2000
    deliver(200)
    assert.equal(journey.playbackSequence.value.length, 0)
    deliver(5)
    assert.equal(journey.playbackSequence.value.length, 0)
    journey.setApproachSuppressed(true)
    now += 2000
    deliver(5)
    assert.equal(journey.playbackSequence.value.length, 0)
    journey.setApproachSuppressed(false)
    assert.equal(journey.playbackSequence.value[0].stopId, nearbyId)
    deliver(5)
    assert.equal(journey.playbackSequence.value.length, 1)
    assert.equal(journey.currentStop.value.id, 'stage-0')
    callbacks[0]!.error({ code: 1 } as GeolocationPositionError)
    assert.equal(journey.tracking.value, false)
    assert.equal(journey.locationPermissionDenied.value, true)
    assert.equal(journey.location.value, null)
    assert.ok(cleared.includes(1))
  } finally {
    app.unmount()
    Date.now = originalNow
    if (previousNavigator) Object.defineProperty(globalThis, 'navigator', previousNavigator)
    else Reflect.deleteProperty(globalThis, 'navigator')
    Object.assign(globalThis, { window: previousWindow, localStorage: previousStorage })
  }
})

test('进入黄包车导航保持静音，手动切站可播放，播完后不自动推进', async () => {
  const previousAudio = globalThis.Audio
  const previousWindow = globalThis.window
  const previousStorage = globalThis.localStorage
  const audios: FakeAudio[] = []
  class FakeAudio {
    currentTime = 0
    duration = 120
    readyState = 1
    onplaying: (() => void) | null = null
    onended: (() => void) | null = null
    constructor() { audios.push(this) }
    play() { this.onplaying?.(); return Promise.resolve() }
    pause() {}
    load() {}
    removeAttribute() {}
    addEventListener() {}
  }
  Object.assign(globalThis, { Audio: FakeAudio, window: { speechSynthesis: undefined }, localStorage: { getItem: () => null, setItem() {}, removeItem() {} } })
  const renderer = createRenderer({
    createElement: () => ({}), insert() {}, remove() {}, createText: () => ({}), createComment: () => ({}),
    setText() {}, setElementText() {}, parentNode: () => null, nextSibling: () => null, patchProp() {},
  })
  let journey: any
  const app = renderer.createApp({ setup() { journey = useTourJourney(); return () => null } })
  app.mount({})
  try {
    journey.preview.value = { route: { id: 'route', locale: 'zh' }, stops: Array.from({ length: 3 }, (_, index) => ({
      id: `stage-${index}`, order: index + 1, name: `景点${index}`, extraAudios: [],
      guideNarrations: [{ id: `guide-${index}`, locale: 'zh', chapters: [{ id: `chapter-${index}`, order: 1, text: '讲解', audioUrl: 'audio.mp3' }] }],
    })) }
    assert.equal(await journey.start(), true)
    assert.equal(journey.drawerOpen.value, false)
    assert.equal(audios.length, 0)
    assert.equal(journey.autoPlayEnabled.value, false)
    assert.equal(journey.drawerStop.value.id, 'stage-0')
    journey.closeContentDrawer()
    await journey.selectStop(1)
    assert.equal(journey.drawerOpen.value, true)
    assert.equal(journey.drawerStop.value.id, 'stage-1')
    journey.openContentDrawer(0, 'map-selection')
    await journey.completeStop()
    assert.equal(journey.drawerStop.value.id, 'stage-2')
    assert.equal(journey.drawerMatchesPlaying.value, true)
    journey.closeContentDrawer()
    journey.previousStop()
    assert.equal(journey.drawerOpen.value, true)
    assert.equal(journey.drawerStop.value.id, 'stage-1')
    journey.selectionMode.value = 'manual'
    journey.closeContentDrawer()
    audios[audios.length - 1]!.onended?.()
    await new Promise(resolve => setTimeout(resolve, 0))
    assert.equal(journey.drawerOpen.value, false)
    assert.equal(journey.drawerStop.value.id, 'stage-1')
  } finally {
    app.unmount()
    Object.assign(globalThis, { Audio: previousAudio, window: previousWindow, localStorage: previousStorage })
  }
})

test('队列去重、暂停自动推进、内容锁定与立即播放保持一致', async () => {
  const previousAudio = globalThis.Audio
  const previousWindow = globalThis.window
  const previousStorage = globalThis.localStorage
  const audios: FakeAudio[] = []
  class FakeAudio {
    currentTime = 0
    duration = 120
    readyState = 1
    onplaying: (() => void) | null = null
    onended: (() => void) | null = null
    constructor() { audios.push(this) }
    play() { this.onplaying?.(); return Promise.resolve() }
    pause() {}
    load() {}
    removeAttribute() {}
    addEventListener() {}
  }
  Object.assign(globalThis, { Audio: FakeAudio, window: { speechSynthesis: undefined }, localStorage: { getItem: () => null, setItem() {}, removeItem() {} } })
  const renderer = createRenderer({
    createElement: () => ({}), insert() {}, remove() {}, createText: () => ({}), createComment: () => ({}),
    setText() {}, setElementText() {}, parentNode: () => null, nextSibling: () => null, patchProp() {},
  })
  let journey: any
  const app = renderer.createApp({ setup() { journey = useTourJourney(); return () => null } })
  app.mount({})
  try {
    journey.preview.value = { route: { id: 'route', locale: 'zh' }, stops: Array.from({ length: 3 }, (_, index) => ({
      id: `stage-${index}`, order: index + 1, name: `景点${index}`, longitude: index * 0.001, latitude: 0,
      extraAudios: [], guideNarrations: [{ id: `guide-${index}`, locale: 'zh', chapters: [{ id: `chapter-${index}`, order: 1, text: '讲解', audioUrl: 'audio.mp3' }] }],
    })) }
    assert.equal(await journey.start(), true)
    await journey.selectStop(0)
    const candidate = {
      index: 1,
      stop: journey.stops.value[1],
      place: null,
      anchor: { longitude: 0.001, latitude: 0 },
      range: null,
      distanceMeters: 0,
      withinRange: true,
      proximityMeters: 50,
      releaseMeters: 80,
    }
    journey.location.value = { longitude: 0.001, latitude: 0, accuracy: 5, heading: null, timestamp: Date.now() }
    journey.arrivalCandidates.value = [candidate]
    await journey.acceptArrival(1)
    journey.arrivalCandidates.value = [candidate]
    await journey.acceptArrival(1)
    assert.deepEqual(journey.playbackSequence.value.map((item: { stopId: string; status: string }) => [item.stopId, item.status]), [['stage-1', 'queued']])
    journey.setAutoPlayEnabled(false)
    journey.setContentAutoSwitchLocked(true)
    audios[audios.length - 1]!.onended?.()
    await new Promise(resolve => setTimeout(resolve, 0))
    assert.equal(journey.speech.status.value, 'idle')
    assert.equal(journey.currentStop.value.id, 'stage-0')
    journey.setAutoPlayEnabled(true)
    await new Promise(resolve => setTimeout(resolve, 0))
    assert.equal(journey.currentStop.value.id, 'stage-0')
    journey.setContentAutoSwitchLocked(false)
    await new Promise(resolve => setTimeout(resolve, 0))
    assert.equal(journey.currentStop.value.id, 'stage-1')
    assert.equal(journey.drawerStop.value.id, 'stage-1')
    assert.equal(journey.playbackSequence.value[0].status, 'playing')
    journey.location.value = { longitude: 0.002, latitude: 0, accuracy: 5, heading: null, timestamp: Date.now() }
    journey.arrivalCandidates.value = [{ ...candidate, index: 2, stop: journey.stops.value[2] }]
    await journey.acceptArrival(2)
    await journey.playQueuedStop('stage-2')
    assert.equal(journey.currentStop.value.id, 'stage-2')
    assert.equal(journey.drawerStop.value.id, 'stage-2')
    assert.deepEqual(journey.playbackSequence.value.map((item: { status: string }) => item.status), ['skipped', 'playing'])
    journey.setAutoPlayEnabled(false)
    audios[audios.length - 1]!.onended?.()
    await new Promise(resolve => setTimeout(resolve, 0))
    assert.equal(journey.playbackSequence.value[1].status, 'completed')
  } finally {
    app.unmount()
    Object.assign(globalThis, { Audio: previousAudio, window: previousWindow, localStorage: previousStorage })
  }
})
