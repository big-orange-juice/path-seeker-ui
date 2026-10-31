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
  entryPoints: { speech: resolve(project, 'src/composables/useTourSpeech.ts'), progression: resolve(project, 'src/utils/tourProgression.ts') },
  bundle: true, platform: 'node', format: 'esm', outdir: temporary, outExtension: { '.js': '.mjs' },
  external: ['vue'], alias: { '@': resolve(project, 'src'), '@path-seeker/ts-shared': resolve(project, '../../packages/ts-shared/src/index.ts') },
})
const { useTourSpeech, buildTourQueue } = await import(pathToFileURL(resolve(temporary, 'speech.mjs')).href)
const { nearbyTourStops } = await import(pathToFileURL(resolve(temporary, 'progression.mjs')).href)

test('回环起点与终点重合时，仅终点依赖本次到访的前序节点，其他站点仍自由触发', () => {
  const start = { id: '391000000000000001', order: 1, longitude: 116.38, latitude: 39.94 }
  const ordinary = { id: '391000000000000002', order: 2, longitude: 116.38, latitude: 39.94 }
  const prerequisite = { id: '391000000000000012', order: 12, longitude: 116.39, latitude: 39.95 }
  const end = { id: '391000000000000013', order: 13, longitude: 116.38, latitude: 39.94, autoTriggerPrerequisiteStageId: prerequisite.id }
  const stops = [start, ordinary, prerequisite, end]
  const now = Date.now(), fix = { longitude: 116.38, latitude: 39.94, accuracy: 5, timestamp: now }
  const ids = (visited: string[], completed: string[] = []) => nearbyTourStops(stops, [], fix, -1, now, undefined, completed, visited).map(item => item.stop.id)
  assert.deepEqual(ids([]), [start.id, ordinary.id])
  // 前序仅到访、未播完也解锁；起点完成后不会因为同坐标重复触发。
  assert.deepEqual(ids([prerequisite.id], [start.id]), [ordinary.id, end.id])
  assert.deepEqual(ids([prerequisite.id], [start.id, end.id]), [ordinary.id])
  // 新游览不继承旧游览的到访状态。
  assert.deepEqual(ids([]), [start.id, ordinary.id])
})

test('前序节点已移出或引用终点自身时，终点自动触发保持锁定', () => {
  const now = Date.now(), fix = { longitude: 116.38, latitude: 39.94, accuracy: 5, timestamp: now }
  for (const predecessor of ['removed', 'end']) {
    const stops = [{ id: 'start', order: 1, longitude: fix.longitude, latitude: fix.latitude },
      { id: 'end', order: 2, longitude: fix.longitude, latitude: fix.latitude, autoTriggerPrerequisiteStageId: predecessor }]
    assert.deepEqual(nearbyTourStops(stops, [], fix, -1, now, undefined, [], [predecessor]).map(item => item.stop.id), ['start'])
  }
})

test('分段讲解按顺序插入音乐和视频，跳过额外媒体时只保留讲解', () => {
  const chapters = [
    { id: 'first', order: 1, text: '第一段', interludes: [{ id: 'video', kind: 'video', title: '历史影像', url: '/film.mp4', order: 2 }, { id: 'music', kind: 'audio', title: '音乐', url: '/music.mp3', order: 1 }] },
    { id: 'second', order: 2, text: '第二段' },
  ]
  assert.deepEqual(buildTourQueue([], chapters).map((item: { id: string }) => item.id), ['first', 'music', 'video', 'second'])
  assert.deepEqual(buildTourQueue([], chapters, { skipExtraAudio: true }).map((item: { id: string }) => item.id), ['first', 'second'])
})

test('节点视频接在全部解说后、后置音频前，跳过额外音频仍保留视频', () => {
  const stop = { id: 'stage', name: '本站影像', video: '/stage.mp4' }
  const chapters = [{ id: 'one', audioUrl: '/one.mp3' }, { id: 'two', audioUrl: '/two.mp3' }]
  const extras = [{ id: 'after', position: 'after', order: 1, url: '/after.mp3' }]
  assert.deepEqual(buildTourQueue(extras, chapters, {}, stop).map(item => item.id), ['one', 'two', 'stop-video-stage', 'after'])
  assert.deepEqual(buildTourQueue(extras, chapters, { skipExtraAudio: true }, stop).map(item => item.id), ['one', 'two', 'stop-video-stage'])
  assert.deepEqual(buildTourQueue([], [], {}, stop).map(item => item.mediaKind), ['video'])
  assert.deepEqual(buildTourQueue([], chapters, {}, { ...stop, video: null }).map(item => item.id), ['one', 'two'])
})

test('解说结束自动播放节点视频，视频播完才完成；手动观看与切站不误完成', () => {
  const created: Media[] = []
  class Media {
    tagName: string; src = ''; currentTime = 0; duration = 30; readyState = 1; ended = false
    onplaying: (() => void) | null = null; onplay: (() => void) | null = null; onpause: (() => void) | null = null; onended: (() => void) | null = null
    playCount = 0; removed = false; webkitDisplayingFullscreen = false; fullscreenExits = 0
    webkitExitFullscreen() { this.fullscreenExits++; this.webkitDisplayingFullscreen = false }
    constructor(src = '', tag = 'AUDIO') { this.src = src; this.tagName = tag; created.push(this) }
    play() { this.playCount++; this.onplay?.(); this.onplaying?.(); return Promise.resolve() }
    pause() { this.onpause?.() }
    load() {}; remove() { this.removed = true }; removeAttribute() {}; addEventListener() {}
  }
  const previous = { Audio: globalThis.Audio, window: globalThis.window, document: globalThis.document }
  Object.assign(globalThis, { Audio: Media, window: { speechSynthesis: undefined }, document: { createElement: () => new Media('', 'VIDEO'), getElementById: () => ({ appendChild() {} }) } })
  const renderer = createRenderer({ createElement: () => ({}), insert() {}, remove() {}, createText: () => ({}), createComment: () => ({}), setText() {}, setElementText() {}, parentNode: () => null, nextSibling: () => null, patchProp() {} })
  let completed = 0, speech: ReturnType<typeof useTourSpeech>
  const app = renderer.createApp({ setup() { speech = useTourSpeech(() => completed++); return () => null } }); app.mount({})
  const stop = { id: 'stage', name: '本站', video: '/stage.mp4', extraAudios: [] }
  try {
    speech!.play(stop, [{ id: 'chapter', audioUrl: '/chapter.mp3' }], 'zh')
    created[0]!.onended?.()
    assert.equal(created[1]!.src, '/stage.mp4'); assert.equal(created[1]!.playCount, 1); assert.equal(completed, 0)
    created[1]!.pause(); assert.equal(speech!.status.value, 'paused')
    speech!.resume(); assert.equal(created[1]!.playCount, 2)
    created[1]!.webkitDisplayingFullscreen = true
    created[1]!.ended = true; created[1]!.onended?.()
    assert.equal(completed, 1); assert.equal(created[1]!.removed, true)
    assert.equal(created[1]!.fullscreenExits, 1); assert.equal(speech!.videoElement.value, null)
    speech!.playVideo(stop, 'zh')
    const lateEnd = created[2]!.onended
    speech!.play({ id: 'next', extraAudios: [] }, [{ id: 'next-chapter', audioUrl: '/next.mp3' }], 'zh')
    lateEnd?.(); assert.equal(speech!.currentItemId.value, 'next-chapter'); assert.equal(completed, 1)
    speech!.playVideo(stop, 'zh'); created[4]!.ended = true; created[4]!.onended?.()
    assert.equal(completed, 1)
    speech!.play(stop, [{ id: 'chapter', audioUrl: '/chapter.mp3' }], 'zh', {}, { queueIndex: 1, itemId: 'stop-video-stage', currentTimeSeconds: 12, paused: true })
    speech!.resume()
    const restoredVideo = created.at(-1)!
    assert.equal(restoredVideo.src, '/stage.mp4'); assert.equal(restoredVideo.currentTime, 12)
    restoredVideo.ended = true; restoredVideo.onended?.(); assert.equal(completed, 2)
  } finally { app.unmount(); Object.assign(globalThis, previous) }
})

test('视频暂停、续播后继续下一段，切站后旧视频事件不可推进新队列', () => {
  const created: Media[] = []
  class Media {
    src = ''; currentTime = 0; duration = 30; readyState = 1; ended = false
    onplaying: (() => void) | null = null; onplay: (() => void) | null = null; onpause: (() => void) | null = null; onended: (() => void) | null = null
    constructor(src = '') { this.src = src; created.push(this) }
    play() { this.onplay?.(); this.onplaying?.(); return Promise.resolve() }
    pause() { this.onpause?.() }
    load() {}; remove() {}; removeAttribute() {}; addEventListener() {}
  }
  const previous = { Audio: globalThis.Audio, window: globalThis.window, document: globalThis.document }
  Object.assign(globalThis, { Audio: Media, window: { speechSynthesis: undefined }, document: { createElement: () => new Media(), getElementById: () => ({ appendChild() {} }) } })
  const renderer = createRenderer({ createElement: () => ({}), insert() {}, remove() {}, createText: () => ({}), createComment: () => ({}), setText() {}, setElementText() {}, parentNode: () => null, nextSibling: () => null, patchProp() {} })
  let completed = 0, speech: ReturnType<typeof useTourSpeech>
  const app = renderer.createApp({ setup() { speech = useTourSpeech(() => completed++); return () => null } }); app.mount({})
  const chapters = [{ id: 'one', order: 1, audioUrl: '/one.mp3', interludes: [{ id: 'film', kind: 'video', url: '/film.mp4', order: 1 }] }, { id: 'two', order: 2, audioUrl: '/two.mp3' }]
  try {
    speech!.play({ id: 'first', extraAudios: [] }, chapters, 'zh')
    created[0]!.onended?.()
    assert.equal(created[1]!.src, '/film.mp4'); assert.equal(completed, 0)
    created[1]!.pause(); assert.equal(speech!.status.value, 'paused')
    speech!.resume(); assert.equal(speech!.status.value, 'playing')
    const oldEnded = created[1]!.onended
    created[1]!.ended = true; oldEnded?.()
    assert.equal(created[2]!.src, '/two.mp3'); assert.equal(completed, 0)
    created[2]!.onended?.(); assert.equal(completed, 1)
    speech!.play({ id: 'next', extraAudios: [] }, [{ id: 'next-chapter', audioUrl: '/next.mp3' }], 'zh')
    oldEnded?.(); assert.equal(speech!.currentItemId.value, 'next-chapter'); assert.equal(completed, 1)
  } finally { app.unmount(); Object.assign(globalThis, previous) }
})

test('跳到后站后仍可发现前面未完成节点，后续节点排序优先，当前节点与已完成节点排除', () => {
  const stops = Array.from({ length: 4 }, (_, index) => ({ id: `stage-${index}`, placeId: `place-${index}`, order: index + 1, longitude: 0, latitude: 0 }))
  const places = stops.map(stop => ({ id: stop.placeId, longitude: 0, latitude: 0 }))
  const fix = { longitude: 0, latitude: 0, accuracy: 5, timestamp: 1000 }
  assert.deepEqual(nearbyTourStops(stops, places, fix, 2, 1000, undefined, ['stage-0']).map((candidate: { stop: { id: string } }) => candidate.stop.id), ['stage-3', 'stage-1'])
})

test('暂停的文件与系统语音允许 seek，位置恢复保持暂停，旧队列结束事件失效', () => {
  const created: FakeAudio[] = []
  class FakeAudio {
    currentTime = 0
    duration = 120
    readyState = 1
    onended: (() => void) | null = null
    onplaying: (() => void) | null = null
    playCount = 0
    src: string
    constructor(src: string) { this.src = src; created.push(this) }
    play() { this.playCount += 1; this.onplaying?.(); return Promise.resolve() }
    pause() {}
    load() {}
    removeAttribute() {}
    addEventListener() {}
  }
  const previousAudio = globalThis.Audio
  const previousWindow = globalThis.window
  Object.assign(globalThis, { Audio: FakeAudio, window: { speechSynthesis: undefined } })
  const renderer = createRenderer({
    createElement: () => ({}), insert: () => {}, remove: () => {}, createText: () => ({}),
    createComment: () => ({}), setText: () => {}, setElementText: () => {}, parentNode: () => null,
    nextSibling: () => null, patchProp: () => {},
  })
  let completed = 0
  let speech: ReturnType<typeof useTourSpeech>
  const app = renderer.createApp({ setup() { speech = useTourSpeech(() => { completed += 1 }); return () => null } })
  app.mount({})
  try {
    const stop = { id: 'stage', extraAudios: [] }
    const chapters = [{ id: 'chapter', order: 1, text: 'hello', audioUrl: 'audio.mp3', durationSeconds: 120 }]
    speech!.play(stop, chapters, 'zh')
    const oldEnded = created[0]!.onended
    created[0]!.currentTime = 20
    speech!.pause()
    assert.equal(speech!.canSeek.value, true)
    assert.equal(speech!.seekBy(15).moved, true)
    assert.equal(created[0]!.currentTime, 35)
    assert.equal(speech!.status.value, 'paused')
    assert.equal(created[0]!.playCount, 1)
    speech!.resume()
    assert.equal(created[0]!.currentTime, 35)
    speech!.play(stop, [{ id: 'english-file', order: 1, text: 'English narration', audioUrl: 'english.mp3', durationSeconds: 90 }], 'en')
    assert.equal(created[1]!.src, 'english.mp3')
    assert.equal(speech!.status.value, 'playing')
    speech!.play(stop, chapters, 'zh', {}, { queueIndex: 0, itemId: 'chapter', currentTimeSeconds: 30, sentenceIndex: 0, paused: true })
    speech!.seekBy(15)
    assert.equal(speech!.captureCheckpoint().currentTimeSeconds, 45)
    oldEnded?.()
    assert.equal(completed, 0)
    speech!.play(stop, [{ id: 'system', order: 1, text: '第一句话很长。第二句话很长。第三句话很长。第四句话很长。第五句话很长。', audioUrl: null }], 'zh', {},
      { queueIndex: 0, itemId: 'system', currentTimeSeconds: 0, sentenceIndex: 0, paused: true })
    assert.equal(speech!.seekBy(15).moved, true)
    assert.equal(speech!.status.value, 'paused')
    assert.ok(speech!.captureCheckpoint().sentenceIndex > 0)
  } finally {
    app.unmount()
    Object.assign(globalThis, { Audio: previousAudio, window: previousWindow })
  }
})
