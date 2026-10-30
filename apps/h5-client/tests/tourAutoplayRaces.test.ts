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
after(() => rm(temporary, { recursive: true, force: true }))
await build({
  stdin: { contents: `export { useTourJourney } from './src/composables/useTourJourney'; export { useTourSpeech } from './src/composables/useTourSpeech'; export { playbackFocus } from './src/utils/playbackFocus';`, resolveDir: project },
  bundle: true, platform: 'node', format: 'esm', outfile: resolve(temporary, 'runtime.mjs'), external: ['vue'],
  alias: { '@': resolve(project, 'src'), '@path-seeker/ts-shared': resolve(project, '../../packages/ts-shared/src/index.ts') },
  plugins: [{ name: 'deferred-catalog', setup(builder: any) {
    builder.onResolve({ filter: /services\/clientCatalog/ }, () => ({ path: 'catalog', namespace: 'fixture' }))
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: `
      export const fetchClientCatalog = async () => ({});
      export const fetchClientTour = async () => ({});
      export const fetchActiveRouteVisit = async () => null;
      export const abandonRouteVisit = async () => {};
      export const startRouteVisit = async () => ({ visitId: 'visit', routeId: 'route', status: 1, currentStageId: 'a', completedStageIds: [] });
      export const updateRouteVisitStop = (...args) => globalThis.tourRaceUpdate(...args);
    ` }))
  } }],
})
const { useTourJourney, useTourSpeech, playbackFocus } = await import(pathToFileURL(resolve(temporary, 'runtime.mjs')).href)
const tick = () => new Promise(resolve => setImmediate(resolve))
const renderer = createRenderer({ createElement: () => ({}), insert() {}, remove() {}, createText: () => ({}), createComment: () => ({}), setText() {}, setElementText() {}, parentNode: () => null, nextSibling: () => null, patchProp() {} })

async function setup() {
  const previous = { Audio: globalThis.Audio, window: globalThis.window, localStorage: globalThis.localStorage, document: globalThis.document, tourRaceUpdate: (globalThis as any).tourRaceUpdate }
  const media: Media[] = [], requests: any[] = [], saved = new Map<string, string>([['path-seeker:skip-extra-audio', '1']])
  const control = { defer: false, deferPlay: false, readyState: 1 }
  class Media {
    tagName = 'AUDIO'; src = ''; currentTime = 0; duration = 60; readyState = control.readyState; ended = false
    onplaying: (() => void) | null = null; onplay: (() => void) | null = null; onpause: (() => void) | null = null
    onended: (() => void) | null = null; onerror: (() => void) | null = null; onloadedmetadata: (() => void) | null = null
    rejectPlay: (reason: unknown) => void = () => {}; playCount = 0
    constructor(src = '') { this.src = src; media.push(this) }
    play() { this.playCount++; this.onplay?.(); this.onplaying?.(); return new Promise<void>((resolve, reject) => { this.rejectPlay = reject; if (!control.deferPlay) resolve() }) }
    pause() { this.onpause?.() }; load() {}; removeAttribute() {}; remove() {}; addEventListener() {}
  }
  const storage = { getItem: (key: string) => saved.get(key) ?? null, setItem: (key: string, value: string) => saved.set(key, value), removeItem: (key: string) => saved.delete(key) }
  Object.assign(globalThis, { Audio: Media, window: { speechSynthesis: undefined, sessionStorage: storage }, localStorage: storage, document: { createElement: () => Object.assign(new Media(), { tagName: 'VIDEO' }), getElementById: () => ({ appendChild() {} }) },
    tourRaceUpdate: (visit: any, id: string, action: string) => new Promise((resolve, reject) => {
      const response = { ...visit, currentStageId: action === 'start' ? id : visit.currentStageId, completedStageIds: action === 'complete' ? [...visit.completedStageIds, id] : visit.completedStageIds }
      requests.push({ id, action, resolve: () => resolve(response), reject })
      if (!control.defer) resolve(response)
    }),
  })
  let journey: any
  const app = renderer.createApp({ setup() { journey = useTourJourney(); return () => null } }); app.mount({})
  const stops = ['a', 'b', 'c'].map(id => ({ id, name: id, order: id.charCodeAt(0) - 96, extraAudios: [], guideNarrations: [{ guideId: 'guide', locale: 'zh', chapters: [{ id: 'chapter-' + id, text: '讲解', audioUrl: '/' + id + '.mp3' }] }] }))
  journey.preview.value = { route: { id: 'route', locale: 'zh' }, stops }
  await journey.start(); requests.length = 0
  return { journey, media, requests, control, saved, cleanup() { app.unmount(); Object.assign(globalThis, previous) } }
}
function queue(journey: any) {
  journey.playbackSequence.value = [{ stopId: 'b', index: 1, status: 'queued', source: 'nearby-auto', queuedAt: Date.now() }]
}
for (const gate of ['ask', 'room', 'autoplay', 'lock', 'hidden']) test('H5 自动切站请求期间阻断：' + gate + '，解除后一次续播', async () => {
  const f = await setup(), { journey: j, requests, control, media } = f
  let room: any
  try {
    queue(j); control.defer = true; j.setAutoPlayEnabled(true); assert.equal(requests.length, 1)
    if (gate === 'ask') { j.setApproachSuppressed(true); j.beginAskInterrupt() }
    if (gate === 'room') { room = playbackFocus.channel('room', () => {}); room.claim(); j.setApproachSuppressed(true) }
    if (gate === 'autoplay') j.setAutoPlayEnabled(false)
    if (gate === 'lock') j.setContentAutoSwitchLocked(true)
    if (gate === 'hidden') j.handleVisibilityHidden()
    requests[0].resolve(); await tick()
    assert.equal(j.speech.status.value, 'idle'); assert.equal(media.length, 0)
    if (gate === 'ask') { j.setApproachSuppressed(false); j.endAskInterrupt() }
    if (gate === 'room') { assert.equal(playbackFocus.current(), 'room'); room.release(); j.setApproachSuppressed(false) }
    if (gate === 'autoplay') j.setAutoPlayEnabled(true)
    if (gate === 'lock') j.setContentAutoSwitchLocked(false)
    if (gate === 'hidden') j.handleVisibilityVisible()
    await tick()
    assert.equal(j.speech.currentItemId.value, 'chapter-b'); assert.equal(j.speech.status.value, 'playing')
    assert.equal(requests.length, 1); assert.equal(media.length, 1)
  } finally { room?.release(); f.cleanup() }
})
test('切换节点使旧待播意图失效，失败的切站不循环重试', async () => {
  const f = await setup(), { journey: j, requests, control } = f
  try {
    queue(j); control.defer = true; j.setAutoPlayEnabled(true); j.setApproachSuppressed(true)
    requests[0].resolve(); await tick()
    const manual = j.selectStop(2); requests[1].resolve(); await manual
    j.setApproachSuppressed(false); await tick()
    assert.equal(j.speech.currentItemId.value, 'chapter-c')
    j.speech.stop(); queue(j); j.setAutoPlayEnabled(true); requests.at(-1).reject(Error('network')); await tick(); await tick()
    assert.equal(requests.length, 3); assert.equal(j.pending.value, false)
  } finally { f.cleanup() }
})
test('同一队列旧 ended 和 play Promise 拒绝均不能修改新条目', async () => {
  const f = await setup(), { journey: j, media, control, requests } = f
  try {
    j.stops.value[0].extraAudios = [{ id: 'extra', position: 'before', order: 1, url: '/extra.mp3' }]
    control.deferPlay = true; j.playCurrentStop()
    const old = media[0]!, lateEnd = old.onended!, lateError = old.onerror!, reject = old.rejectPlay
    control.deferPlay = false; lateError()
    assert.equal(j.speech.currentItemId.value, 'chapter-a')
    lateEnd(); lateError(); reject(Object.assign(Error('blocked'), { name: 'NotAllowedError' })); await tick()
    assert.equal(j.speech.currentItemId.value, 'chapter-a'); assert.equal(j.speech.status.value, 'playing'); assert.equal(j.speech.blocked.value, false); assert.equal(requests.length, 0)
    j.speech.pause(); j.speech.resume(); assert.equal(j.speech.status.value, 'playing')
  } finally { f.cleanup() }
})
for (const end of ['ended', 'skip', 'error']) test('纯视频正式站完成判定：' + end, async () => {
  const f = await setup(), { journey: j, media, requests } = f
  try {
    j.stops.value[0].video = '/video.mp4'; j.stops.value[0].guideNarrations = []; j.playCurrentStop()
    if (end === 'ended') { media.at(-1)!.ended = true; media.at(-1)!.onended!() }
    else if (end === 'skip') j.speech.skipInterlude()
    else media.at(-1)!.onerror!()
    await tick()
    assert.equal(requests.length, end === 'ended' ? 1 : 0)
    assert.deepEqual(j.visit.value.completedStageIds, end === 'ended' ? ['a'] : [])
  } finally { f.cleanup() }
})
for (const end of ['ended', 'skip', 'error']) test('独立视频结束恢复讲解 21 秒且不提前完成：' + end, async () => {
  const f = await setup(), { journey: j, media, requests } = f
  try {
    j.stops.value[0].video = '/video.mp4'; j.playCurrentStop(); media.at(-1)!.currentTime = 21; j.playStopVideo()
    if (end === 'ended') { media.at(-1)!.ended = true; media.at(-1)!.onended!() }
    else if (end === 'skip') j.speech.skipInterlude()
    else media.at(-1)!.onerror!()
    assert.equal(j.speech.currentItemId.value, 'chapter-a'); assert.equal(j.speech.captureCheckpoint().currentTimeSeconds, 21); assert.equal(requests.length, 0)
  } finally { f.cleanup() }
})
test('独立视频经历提问和暂停续播后仍恢复原队列', async () => {
  const f = await setup(), { journey: j, media } = f
  try {
    j.stops.value[0].video = '/video.mp4'; j.playCurrentStop(); media.at(-1)!.currentTime = 17; j.playStopVideo()
    j.beginAskInterrupt(); j.endAskInterrupt(); j.togglePlayback(); j.togglePlayback()
    media.at(-1)!.ended = true; media.at(-1)!.onended!()
    assert.equal(j.speech.currentItemId.value, 'chapter-a'); assert.equal(j.speech.captureCheckpoint().currentTimeSeconds, 17)
  } finally { f.cleanup() }
})
test('忙碌期间自然播完，手动完成失败后补交一次，补交失败不循环', async () => {
  const f = await setup(), { journey: j, media, requests, control } = f
  try {
    j.playCurrentStop(); control.defer = true
    const manual = j.completeStop(); media[0]!.onended!(); assert.equal(requests.length, 1)
    requests[0].reject(Error('network')); await manual; await tick()
    assert.equal(requests.length, 2); assert.equal(requests[1].action, 'complete')
    requests[1].reject(Error('network')); await tick(); await tick()
    assert.equal(requests.length, 2); assert.equal(j.pending.value, false)
  } finally { f.cleanup() }
})
test('独立视频恢复主音频元数据未加载时，提问不把断点覆盖成零', async () => {
  const f = await setup(), { journey: j, media, control } = f
  try {
    j.stops.value[0].video = '/video.mp4'; j.playCurrentStop(); media.at(-1)!.currentTime = 23; j.playStopVideo()
    control.readyState = 0; media.at(-1)!.ended = true; media.at(-1)!.onended!()
    assert.equal(j.speech.captureCheckpoint().currentTimeSeconds, 23)
    j.beginAskInterrupt(); assert.equal(j.speech.captureCheckpoint().currentTimeSeconds, 23)
    j.endAskInterrupt(); media.at(-1)!.readyState = 1; media.at(-1)!.onloadedmetadata!()
    assert.equal(j.speech.captureCheckpoint().currentTimeSeconds, 23)
  } finally { f.cleanup() }
})
test('历史跳过偏好不再静默跳过默认额外音频', async () => {
  const f = await setup(), { journey: j, media } = f
  try {
    j.stops.value[0].extraAudios = [{ id: 'before', position: 'before', order: 1, url: '/before.mp3' }]
    j.playCurrentStop(); assert.equal(j.speech.currentItemId.value, 'before')
    media[0]!.onended!(); assert.equal(j.speech.currentItemId.value, 'chapter-a')
  } finally { f.cleanup() }
})

test('问答音频先结束但浮层未关闭时保留恢复意图，关闭后继续原位置', async () => {
  const f = await setup(), { journey: j, media } = f
  try {
    j.playCurrentStop(); media.at(-1)!.currentTime = 19
    j.beginAskInterrupt(); j.setApproachSuppressed(true)
    assert.equal(j.endAskInterrupt(), 'noop'); assert.equal(j.speech.status.value, 'paused')
    j.setApproachSuppressed(false); j.endAskInterrupt()
    assert.equal(j.speech.status.value, 'playing'); assert.equal(j.speech.captureCheckpoint().currentTimeSeconds, 19)
  } finally { f.cleanup() }
})
test('暂停前的 play Promise 迟到拒绝不能把同一媒体的续播改为阻止', async () => {
  const f = await setup(), { journey: j, media, control } = f
  try {
    control.deferPlay = true; j.playCurrentStop(); const reject = media[0]!.rejectPlay
    j.togglePlayback(); control.deferPlay = false; j.togglePlayback()
    reject(Object.assign(Error('old blocked'), { name: 'NotAllowedError' })); await tick()
    assert.equal(j.speech.status.value, 'playing'); assert.equal(j.speech.blocked.value, false)
  } finally { f.cleanup() }
})
test('同一队列旧系统语音句子的 end/error 不得跳过或终止下一句', async () => {
  const f = await setup(), { journey: j } = f
  const previousUtterance = globalThis.SpeechSynthesisUtterance
  const spoken: any[] = []
  class Utterance { text: string; constructor(text: string) { this.text = text } }
  Object.assign(globalThis, { SpeechSynthesisUtterance: Utterance })
  ;(globalThis.window as any).speechSynthesis = { getVoices: () => [{ lang: 'zh-CN' }], resume() {}, cancel() {}, speak(u: any) { spoken.push(u); u.onstart?.() }, removeEventListener() {} }
  try {
    j.stops.value[0].guideNarrations[0].chapters = [{ id: 'tts', text: '第一句。第二句。' }]
    j.playCurrentStop(); const end = spoken[0].onend, error = spoken[0].onerror
    end(); assert.equal(spoken.length, 2)
    end(); error(); assert.equal(spoken.length, 2); assert.equal(j.speech.status.value, 'playing'); assert.equal(j.speech.currentSentenceIndex.value, 1)
  } finally { f.cleanup(); Object.assign(globalThis, { SpeechSynthesisUtterance: previousUtterance }) }
})
test('等待系统音色期间暂停续播，旧音色回调不可重复启动语音', async () => {
  const f = await setup(), { journey: j } = f
  const previousUtterance = globalThis.SpeechSynthesisUtterance
  const callbacks: Array<() => void> = [], spoken: any[] = []
  let voicesReady = false
  class Utterance { text: string; constructor(text: string) { this.text = text } }
  Object.assign(globalThis, { SpeechSynthesisUtterance: Utterance })
  ;(globalThis.window as any).speechSynthesis = { getVoices: () => voicesReady ? [{ lang: 'zh-CN' }] : [], resume() {}, cancel() {}, speak(u: any) { spoken.push(u); u.onstart?.() }, addEventListener(_name: string, callback: () => void) { callbacks.push(callback) }, removeEventListener() {} }
  try {
    j.stops.value[0].guideNarrations[0].chapters = [{ id: 'tts', text: '等待音色。' }]
    j.playCurrentStop(); const old = callbacks[0]!
    j.togglePlayback(); voicesReady = true; j.togglePlayback(); assert.equal(spoken.length, 1)
    old(); assert.equal(spoken.length, 1); assert.equal(j.speech.status.value, 'playing')
  } finally { f.cleanup(); Object.assign(globalThis, { SpeechSynthesisUtterance: previousUtterance }) }
})
for (const action of ['play', 'toggle', 'skip']) test('自动入站受阻后手动' + action + '消费待播意图且不重复 start', async () => {
  const f = await setup(), { journey: j, requests, control } = f
  try {
    queue(j); control.defer = true; j.setAutoPlayEnabled(true); j.setAutoPlayEnabled(false)
    requests[0].resolve(); await tick(); assert.equal(j.playbackSequence.value[0].status, 'queued')
    if (action === 'play') await j.playQueuedStop('b')
    else if (action === 'toggle') j.togglePlayback()
    else j.skipQueuedStop('b')
    j.setAutoPlayEnabled(true); await tick()
    assert.equal(requests.length, 1); assert.equal(j.speech.currentItemId.value, action === 'skip' ? null : 'chapter-b')
  } finally { f.cleanup() }
})

test('后台返回时房间仍占用声音，解除后已有待播请求能继续', async () => {
  const f = await setup(), { journey: j, requests, control } = f
  try {
    queue(j); control.defer = true; j.setAutoPlayEnabled(true); j.setApproachSuppressed(true); j.handleVisibilityHidden()
    requests[0].resolve(); await tick()
    j.handleVisibilityVisible(false); assert.equal(j.speech.status.value, 'idle')
    j.setApproachSuppressed(false); await tick()
    assert.equal(j.speech.currentItemId.value, 'chapter-b'); assert.equal(requests.length, 1)
  } finally { f.cleanup() }
})
test('重复打开提问不能把原来的播放恢复意图覆盖为暂停', async () => {
  const f = await setup(), { journey: j, media } = f
  try {
    j.playCurrentStop(); media.at(-1)!.currentTime = 16; j.beginAskInterrupt(); j.beginAskInterrupt(); j.endAskInterrupt()
    assert.equal(j.speech.status.value, 'playing'); assert.equal(j.speech.captureCheckpoint().currentTimeSeconds, 16)
  } finally { f.cleanup() }
})
