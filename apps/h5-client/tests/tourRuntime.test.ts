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
const { useTourSpeech } = await import(pathToFileURL(resolve(temporary, 'speech.mjs')).href)
const { nearbyTourStops } = await import(pathToFileURL(resolve(temporary, 'progression.mjs')).href)

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
