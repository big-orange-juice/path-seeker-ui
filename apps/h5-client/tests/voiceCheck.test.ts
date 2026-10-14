import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'

const source = readFileSync(new URL('../public/voice-check.js', import.meta.url), 'utf8')

function setup() {
  const elements = new Map<string, EventTarget & { disabled: boolean; textContent: string }>()
  for (const name of ['microphone', 'recognize', 'stop', 'copy', 'status', 'log']) {
    elements.set(name, Object.assign(new EventTarget(), { disabled: false, textContent: '' }))
  }
  const instances: FakeRecognition[] = []
  class FakeRecognition extends EventTarget {
    starts = 0
    stops = 0
    aborts = 0
    constructor() { super(); instances.push(this) }
    start() { this.starts += 1 }
    stop() { this.stops += 1 }
    abort() { this.aborts += 1; this.dispatchEvent(new Event('end')) }
  }
  const page = Object.assign(new EventTarget(), { SpeechRecognition: FakeRecognition, isSecureContext: true })
  const document = Object.assign(new EventTarget(), { visibilityState: 'visible', getElementById: (name: string) => elements.get(name) })
  let releases = 0
  let copied = ''
  const timers = new Set<() => void>()
  runInNewContext(source, {
    window: page,
    document,
    performance: { now: () => 100 },
    navigator: {
      userAgent: 'test-browser',
      userActivation: { isActive: true },
      mediaDevices: { getUserMedia: async () => ({
        getAudioTracks: () => [{ readyState: 'live' }],
        getTracks: () => [{ stop() { releases += 1 } }],
      }) },
      clipboard: { writeText: async (text: string) => { copied = text } },
    },
    setTimeout: (callback: () => void) => { timers.add(callback); return callback },
    clearTimeout: (callback: () => void) => timers.delete(callback),
  })
  const click = (name: string) => elements.get(name)!.dispatchEvent(new Event('click'))
  return { instances, page, elements, timers, click, releases: () => releases, copied: () => copied }
}

test('独立检测页授权后立即释放轨道，不自动启动识别', async () => {
  const page = setup()
  page.click('microphone')
  await new Promise<void>(resolve => setImmediate(resolve))
  assert.equal(page.releases(), 1)
  assert.equal(page.instances.length, 0)
  assert.equal(page.elements.get('recognize')!.disabled, false)
})

test('独立检测不自动重试，收到 end 后才允许复用同一实例', () => {
  const page = setup()
  page.click('recognize')
  const engine = page.instances[0]!
  engine.dispatchEvent(new Event('start'))
  engine.dispatchEvent(Object.assign(new Event('error'), { error: 'aborted' }))
  page.click('recognize')
  assert.equal(engine.starts, 1)
  assert.equal(page.instances.length, 1)
  engine.dispatchEvent(new Event('end'))
  assert.equal(page.timers.size, 0)
  page.click('recognize')
  assert.equal(engine.starts, 2)
  assert.equal(page.instances.length, 1)
})

test('检测记录不包含识别文本，离开页面释放识别并清理定时器', async () => {
  const page = setup()
  page.click('recognize')
  const engine = page.instances[0]!
  engine.dispatchEvent(Object.assign(new Event('result'), { results: [{ 0: { transcript: '不要记录的内容' } }] }))
  page.click('copy')
  await Promise.resolve()
  assert.ok(page.copied().includes('resultCount'))
  assert.equal(page.copied().includes('不要记录'), false)
  page.page.dispatchEvent(new Event('pagehide'))
  assert.equal(engine.aborts, 1)
  assert.equal(page.timers.size, 0)
})
