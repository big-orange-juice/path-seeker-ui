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

test('地图定位不触发附近讲解、入队或切换内容，手动选站仍可播放', async () => {
  const previousAudio = globalThis.Audio
  const previousWindow = globalThis.window
  const previousStorage = globalThis.localStorage
  const previousGeolocation = Object.getOwnPropertyDescriptor(navigator, 'geolocation')
  const locationCallbacks: Array<(position: any) => void> = []
  Object.defineProperty(navigator, 'geolocation', { configurable: true, value: {
    watchPosition(callback: (position: any) => void) { locationCallbacks.push(callback); return locationCallbacks.length },
    clearWatch() {},
  } })
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
    journey.closeContentDrawer()
    journey.startTracking()
    const sequenceBeforeLocation = JSON.stringify(journey.playbackSequence.value)
    const position = { coords: { longitude: 0.001, latitude: 0, accuracy: 5, heading: 0 }, timestamp: Date.now() }
    for (const callback of locationCallbacks) callback(position)
    await new Promise(resolve => setTimeout(resolve, 1700))
    for (const callback of locationCallbacks) callback({ ...position, timestamp: Date.now() })
    assert.equal(journey.location.value.longitude, 0.001)
    assert.equal(journey.currentStop.value.id, 'stage-0')
    assert.equal(journey.drawerOpen.value, false)
    assert.equal(JSON.stringify(journey.playbackSequence.value), sequenceBeforeLocation)
    assert.equal(audios.length, 1)
    audios[0]!.onended?.()
    await new Promise(resolve => setTimeout(resolve, 0))
    assert.equal(journey.currentStop.value.id, 'stage-0')
    assert.equal(journey.speech.status.value, 'idle')
    await journey.selectStop(1)
    assert.equal(journey.currentStop.value.id, 'stage-1')
    assert.equal(journey.speech.status.value, 'playing')
    journey.stopTracking()
    assert.equal(journey.location.value, null)
  } finally {
    app.unmount()
    if (previousGeolocation) Object.defineProperty(navigator, 'geolocation', previousGeolocation)
    else Reflect.deleteProperty(navigator, 'geolocation')
    Object.assign(globalThis, { Audio: previousAudio, window: previousWindow, localStorage: previousStorage })
  }
})
