import test from 'node:test'
import assert from 'node:assert/strict'
import { computed, effectScope, nextTick } from 'vue'
import { useBrowserSpeechRecognition } from '../src/composables/useBrowserSpeechRecognition.ts'
import { useVoiceHold } from '../src/composables/useVoiceHold.ts'

class FakeRecognition {
  static latest: FakeRecognition
  lang = ''
  continuous = false
  interimResults = false
  maxAlternatives = 1
  starts = 0
  stops = 0
  aborts = 0
  onstart: (() => void) | null = null
  onend: (() => void) | null = null
  onerror: ((event: { error: string }) => void) | null = null
  onresult: ((event: any) => void) | null = null
  constructor() { FakeRecognition.latest = this }
  start() { this.starts += 1; this.onstart?.() }
  stop() { this.stops += 1 }
  abort() { this.aborts += 1 }
  result(parts: Array<[string, boolean]>, resultIndex = 0) {
    this.onresult?.({ resultIndex, results: parts.map(([transcript, isFinal]) => ({ 0: { transcript }, length: 1, isFinal })) })
  }
}

function setup(testContext: any, supported = true) {
  const previousWindow = globalThis.window
  const previousDocument = globalThis.document
  const fakeWindow = Object.assign(new EventTarget(), { SpeechRecognition: FakeRecognition })
  Object.assign(globalThis, { window: fakeWindow, document: Object.assign(new EventTarget(), { visibilityState: 'visible' }) })
  let now = 1000
  testContext.mock.method(Date, 'now', () => now)
  testContext.mock.timers.enable({ apis: ['setTimeout'] })
  const scope = effectScope()
  const recognition = useBrowserSpeechRecognition()
  recognition.abort()
  const actions: string[] = []
  const hold = scope.run(() => useVoiceHold({
    recognition: supported ? recognition : { ...recognition, supported: computed(() => false) },
    lang: () => 'en-US',
    onStart: () => actions.push('start'),
    onSubmit: (text) => actions.push(`submit:${text}`),
    onCancel: () => actions.push('cancel'),
    onError: (message) => actions.push(`error:${message}`),
    onTap: () => actions.push('tap'),
  }))!
  const target = {
    captured: false,
    setPointerCapture() { this.captured = true },
    hasPointerCapture() { return this.captured },
    releasePointerCapture() { this.captured = false },
  }
  const pointer = (clientY = 100) => ({ button: 0, isPrimary: true, pointerId: 7, clientY, currentTarget: target, preventDefault() {} }) as unknown as PointerEvent
  testContext.after(() => {
    scope.stop()
    recognition.abort()
    Object.assign(globalThis, { window: previousWindow, document: previousDocument })
  })
  return { recognition, hold, actions, pointer, target, advance: () => { now += 500; testContext.mock.timers.tick(500) }, fakeWindow }
}

test('外部长按保持原页，松开等最终识别结束后才提交一次', async (testContext) => {
  const { hold, actions, pointer, advance, target } = setup(testContext)
  hold.pointerDown(pointer())
  assert.deepEqual(actions, [])
  advance()
  const engine = FakeRecognition.latest
  assert.equal(engine.continuous, true)
  assert.equal(engine.lang, 'en-US')
  engine.result([['临时内容', false]])
  assert.deepEqual(actions, ['start'])
  advance()
  const released = hold.pointerUp(pointer())
  assert.equal(hold.finishing.value, true)
  assert.equal(target.captured, false)
  assert.deepEqual(actions, ['start'])
  engine.result([['最终问题', true]])
  engine.onend?.()
  await released
  assert.deepEqual(actions, ['start', 'submit:最终问题'])
  hold.click()
  assert.deepEqual(actions, ['start', 'submit:最终问题'])
})

test('持续说话累积完整结果，重复结果事件不重复文本，停顿后继续监听', async (testContext) => {
  const { recognition } = setup(testContext)
  recognition.start({ continuous: true })
  const engine = FakeRecognition.latest
  engine.result([['第一句。', true]])
  engine.result([['第一句。', true], ['第二句。', true]], 1)
  assert.equal(recognition.finalText.value, '第一句。第二句。')
  engine.onend?.()
  assert.equal(recognition.listening.value, true)
  testContext.mock.timers.tick(130)
  const restarted = FakeRecognition.latest
  assert.notEqual(restarted, engine)
  assert.equal(restarted.starts, 1)
  restarted.result([['第三句。', false]])
  const completed = recognition.stop()
  restarted.onend?.()
  assert.equal(await completed, '第一句。第二句。第三句。')
})

test('上滑取消不提交并释放麦克风', async (testContext) => {
  const { hold, actions, pointer, advance, recognition } = setup(testContext)
  hold.pointerDown(pointer())
  advance()
  FakeRecognition.latest.result([['不要发送', true]])
  hold.pointerMove(pointer(30))
  advance()
  await hold.pointerUp(pointer(30))
  assert.deepEqual(actions, ['start', 'cancel'])
  assert.equal(FakeRecognition.latest.aborts, 1)
  assert.equal(recognition.transcript.value, '')
})

test('短按只打开普通问答，不发送收音内容', async (testContext) => {
  const { hold, actions, pointer } = setup(testContext)
  const previousEngine = FakeRecognition.latest
  hold.pointerDown(pointer())
  await hold.pointerUp(pointer())
  hold.click()
  assert.deepEqual(actions, ['tap'])
  assert.equal(FakeRecognition.latest, previousEngine)
})

test('空输入和权限拒绝留在原页，不发送', async (testContext) => {
  const { hold, actions, pointer, advance } = setup(testContext)
  hold.pointerDown(pointer())
  advance()
  const released = hold.pointerUp(pointer())
  FakeRecognition.latest.onend?.()
  await released
  assert.ok(actions.some(action => action.startsWith('error:')))
  assert.equal(actions.some(action => action.startsWith('submit:') || action === 'tap'), false)
  actions.length = 0
  hold.pointerDown(pointer())
  advance()
  FakeRecognition.latest.onerror?.({ error: 'not-allowed' })
  await nextTick()
  assert.equal(hold.active.value, false)
  assert.equal(actions.some(action => action.startsWith('submit:') || action === 'tap'), false)
})

test('识别收尾期间退出或切后台，延迟结果不会误发送', async (testContext) => {
  const { hold, actions, pointer, advance, fakeWindow } = setup(testContext)
  hold.pointerDown(pointer())
  advance()
  const engine = FakeRecognition.latest
  const oldEnd = engine.onend
  engine.result([['取消的问题', false]])
  advance()
  const released = hold.pointerUp(pointer())
  fakeWindow.dispatchEvent(new Event('blur'))
  oldEnd?.()
  await released
  assert.deepEqual(actions, ['start', 'cancel'])
})

test('浏览器停顿重启前松开，保留已识别结果且不再次启动', async (testContext) => {
  const { recognition } = setup(testContext)
  recognition.start({ continuous: true })
  const engine = FakeRecognition.latest
  engine.result([['保留内容', true]])
  engine.onend?.()
  assert.equal(await recognition.stop(), '保留内容')
  testContext.mock.timers.tick(130)
  assert.equal(engine.starts, 1)
})

test('不支持识别的浏览器短按可进入文字问答，长按提示失败而不打开聊天', async (testContext) => {
  const { hold, actions, pointer, advance } = setup(testContext, false)
  hold.pointerDown(pointer())
  await hold.pointerUp(pointer())
  hold.click()
  assert.deepEqual(actions, ['tap'])
  actions.length = 0
  hold.pointerDown(pointer())
  advance()
  await hold.pointerUp(pointer())
  hold.click()
  assert.equal(actions.length, 1)
  assert.ok(actions[0]!.startsWith('error:'))
})

test('松开后浏览器不返回结束事件时，收尾上限保留文本且迟到结果失效', async (testContext) => {
  const { recognition } = setup(testContext)
  recognition.start({ continuous: true })
  const engine = FakeRecognition.latest
  const oldResult = engine.onresult
  engine.result([['已有内容', false]])
  const completed = recognition.stop()
  testContext.mock.timers.tick(2000)
  assert.equal(await completed, '已有内容')
  oldResult?.({ resultIndex: 0, results: [{ 0: { transcript: '迟到内容' }, isFinal: true, length: 1 }] })
  assert.equal(recognition.transcript.value, '已有内容')
})
