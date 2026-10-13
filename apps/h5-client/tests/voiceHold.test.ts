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

function setup(testContext: any, supported = true, handoff = false) {
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
  const completions: Promise<string>[] = []
  const hold = scope.run(() => useVoiceHold({
    recognition: supported ? recognition : { ...recognition, supported: computed(() => false) },
    lang: () => 'en-US',
    onStart: () => actions.push('start'),
    onSubmit: (text) => actions.push(`submit:${text}`),
    onRelease: handoff ? (completion) => { actions.push('release'); completions.push(completion) } : undefined,
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
  return { recognition, hold, actions, completions, scope, pointer, target, advance: () => { now += 500; testContext.mock.timers.tick(500) }, fakeWindow }
}

test('Chat 内按住收音，松开等最终识别结束后才提交一次', async (testContext) => {
  const { hold, actions, pointer, advance, target } = setup(testContext)
  hold.pointerDown(pointer())
  assert.deepEqual(actions, ['start'])
  assert.equal(FakeRecognition.latest.starts, 1)
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

test('短按丢弃本次收音并打开普通问答，不发送收音内容', async (testContext) => {
  const { hold, actions, pointer } = setup(testContext)
  hold.pointerDown(pointer())
  const engine = FakeRecognition.latest
  await hold.pointerUp(pointer())
  hold.click()
  assert.deepEqual(actions, ['start', 'cancel', 'tap'])
  assert.equal(engine.aborts, 1)
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
  const { hold, actions, pointer, advance } = setup(testContext)
  hold.pointerDown(pointer())
  advance()
  const engine = FakeRecognition.latest
  const oldEnd = engine.onend
  engine.result([['取消的问题', false]])
  advance()
  const released = hold.pointerUp(pointer())
  Object.assign(document, { visibilityState: 'hidden' })
  document.dispatchEvent(new Event('visibilitychange'))
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
  assert.equal(engine.aborts, 1)
})

test('麦克风授权弹窗失焦不会取消收音，松开正常提交', async (testContext) => {
  const { hold, actions, pointer, advance, fakeWindow } = setup(testContext)
  hold.pointerDown(pointer())
  fakeWindow.dispatchEvent(new Event('blur'))
  assert.equal(hold.held.value, true)
  const engine = FakeRecognition.latest
  engine.result([['授权后的问题', true]])
  advance()
  const released = hold.pointerUp(pointer())
  engine.onend?.()
  await released
  assert.deepEqual(actions, ['start', 'submit:授权后的问题'])
})

test('松开后 aborted 正常收尾，保留已有识别内容并发送', async (testContext) => {
  const { hold, actions, pointer, advance, recognition } = setup(testContext)
  hold.pointerDown(pointer())
  const engine = FakeRecognition.latest
  engine.result([['为什么是斜的', false]])
  advance()
  const released = hold.pointerUp(pointer())
  engine.onerror?.({ error: 'aborted' })
  await released
  assert.equal(recognition.error.value, '')
  assert.deepEqual(actions, ['start', 'submit:为什么是斜的'])
})

test('按住期间意外中断会重启，保留前后语音且迟到事件失效', async (testContext) => {
  const { hold, actions, pointer, advance, recognition } = setup(testContext)
  hold.pointerDown(pointer())
  const engine = FakeRecognition.latest
  const lateError = engine.onerror
  engine.result([['烟袋斜街', true]])
  engine.onerror?.({ error: 'aborted' })
  await nextTick()
  assert.equal(hold.held.value, true)
  assert.equal(recognition.error.value, '')
  testContext.mock.timers.tick(100)
  const restarted = FakeRecognition.latest
  assert.notEqual(restarted, engine)
  lateError?.({ error: 'not-allowed' })
  restarted.result([['为什么是斜的', false]])
  advance()
  const released = hold.pointerUp(pointer())
  restarted.onend?.()
  await released
  assert.deepEqual(actions, ['start', 'submit:烟袋斜街为什么是斜的'])
})

test('连续中断超过重试上限提示失败，不循环占用麦克风', async (testContext) => {
  const { hold, actions, pointer, recognition } = setup(testContext)
  hold.pointerDown(pointer())
  for (let attempt = 0; attempt < 3; attempt += 1) {
    FakeRecognition.latest.onerror?.({ error: 'aborted' })
    testContext.mock.timers.tick(100)
  }
  await nextTick()
  assert.equal(hold.active.value, false)
  assert.equal(recognition.listening.value, false)
  assert.ok(actions.some(action => action.includes('浏览器多次中断收音')))
  assert.equal(actions.some(action => action.startsWith('submit:')), false)
})

test('识别尚未启动时松开，等待 onstart 后停止并接收最终结果', async (testContext) => {
  const { hold, actions, pointer, advance } = setup(testContext)
  testContext.mock.method(FakeRecognition.prototype, 'start', function (this: FakeRecognition) { this.starts += 1 })
  hold.pointerDown(pointer())
  const engine = FakeRecognition.latest
  advance()
  const released = hold.pointerUp(pointer())
  assert.equal(engine.stops, 0)
  engine.onstart?.()
  assert.equal(engine.stops, 1)
  engine.result([['启动后的结果', true]])
  engine.onend?.()
  await released
  assert.deepEqual(actions, ['start', 'submit:启动后的结果'])
})

test('意外中断的重启等待中松开，提交已有内容并取消重启', async (testContext) => {
  const { hold, actions, pointer, advance } = setup(testContext)
  hold.pointerDown(pointer())
  advance()
  const engine = FakeRecognition.latest
  engine.result([['已有问题', false]])
  engine.onerror?.({ error: 'aborted' })
  await hold.pointerUp(pointer())
  testContext.mock.timers.tick(100)
  assert.equal(FakeRecognition.latest, engine)
  assert.deepEqual(actions, ['start', 'submit:已有问题'])
})

test('外部语音键松开立即打开问答，不等待识别结果或长按门槛', async (testContext) => {
  const { hold, actions, pointer, completions } = setup(testContext, true, true)
  hold.pointerDown(pointer())
  const engine = FakeRecognition.latest
  const released = hold.pointerUp(pointer())
  assert.deepEqual(actions, ['start', 'release'])
  assert.equal(hold.active.value, false)
  assert.equal(completions.length, 1)
  engine.result([['松手后的最终问题', true]])
  engine.onend?.()
  await released
  assert.equal(await completions[0], '松手后的最终问题')
  assert.deepEqual(actions, ['start', 'release'])
})

test('松开跳转后来源页面卸载，不丢失交给问答的收尾结果', async (testContext) => {
  const { hold, actions, pointer, completions, scope } = setup(testContext, true, true)
  hold.pointerDown(pointer())
  const engine = FakeRecognition.latest
  await hold.pointerUp(pointer())
  scope.stop()
  assert.equal(engine.aborts, 0)
  engine.result([['页面切换后的问题', true]])
  engine.onend?.()
  assert.equal(await completions[0], '页面切换后的问题')
  assert.deepEqual(actions, ['start', 'release'])
})

test('外部识别失败仍保留松手动作，立即进入问答展示错误', async (testContext) => {
  const { hold, actions, pointer, completions, recognition } = setup(testContext, true, true)
  hold.pointerDown(pointer())
  FakeRecognition.latest.onerror?.({ error: 'network' })
  await nextTick()
  assert.equal(hold.held.value, true)
  await hold.pointerUp(pointer())
  assert.equal(actions.at(-1), 'release')
  assert.equal(await completions[0], '')
  assert.ok(recognition.error.value.includes('服务连接失败'))
})

test('外部开麦启动失败或不支持识别，松手仍进入问答页', async (testContext) => {
  const { hold, actions, pointer, completions } = setup(testContext, true, true)
  testContext.mock.method(FakeRecognition.prototype, 'start', () => { throw new Error('service unavailable') })
  hold.pointerDown(pointer())
  assert.equal(hold.held.value, true)
  await hold.pointerUp(pointer())
  assert.equal(actions.at(-1), 'release')
  assert.equal(await completions[0], '')
})

test('外部浏览器不支持识别，松手进入问答显示兼容性原因', async (testContext) => {
  const { hold, actions, pointer, completions, recognition } = setup(testContext, false, true)
  hold.pointerDown(pointer())
  await hold.pointerUp(pointer())
  assert.equal(actions.at(-1), 'release')
  assert.equal(await completions[0], '')
  assert.ok(recognition.error.value.includes('不支持语音识别'))
})
