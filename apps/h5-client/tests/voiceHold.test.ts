import test from 'node:test'
import assert from 'node:assert/strict'
import { computed, effectScope, nextTick, shallowRef } from 'vue'
import { useBrowserSpeechRecognition } from '../src/composables/useBrowserSpeechRecognition.ts'
import { useVoiceHold } from '../src/composables/useVoiceHold.ts'
import type { MicrophoneAccess } from '../src/composables/useMicrophoneAccess.ts'

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
  onaudiostart: (() => void) | null = null
  onaudioend: (() => void) | null = null
  onend: (() => void) | null = null
  onerror: ((event: { error: string }) => void) | null = null
  onresult: ((event: any) => void) | null = null
  constructor() { FakeRecognition.latest = this }
  start() { this.starts += 1; this.onstart?.() }
  stop() { this.stops += 1 }
  abort() { this.aborts += 1; this.onend?.() }
  result(parts: Array<[string, boolean]>, resultIndex = 0) {
    this.onresult?.({ resultIndex, results: parts.map(([transcript, isFinal]) => ({ 0: { transcript }, length: 1, isFinal })) })
  }
}

function setup(testContext: any, supported = true, handoff = false, microphone?: MicrophoneAccess) {
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
  FakeRecognition.latest?.onend?.()
  const actions: string[] = []
  const completions: Promise<string>[] = []
  const hold = scope.run(() => useVoiceHold({
    recognition: supported ? recognition : { ...recognition, supported: computed(() => false) },
    microphone,
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

function dispatchPointer(type: string, pointer: PointerEvent) {
  const event = Object.assign(new Event(type, { cancelable: true }), {
    pointerId: pointer.pointerId,
    clientY: pointer.clientY,
  })
  document.dispatchEvent(event)
}

test('捕获指针失败仍立即启动导航收音，按钮外松手只交接一次', async (testContext) => {
  const { hold, actions, pointer, target, completions } = setup(testContext, true, true)
  testContext.mock.method(target, 'setPointerCapture', () => { throw new Error('capture unavailable') })
  hold.pointerDown(pointer())
  const engine = FakeRecognition.latest
  assert.equal(engine.starts, 1)
  assert.equal(hold.held.value, true)
  engine.result([['导航问题', true]])
  dispatchPointer('pointerup', pointer())
  await hold.pointerUp(pointer())
  assert.equal(engine.stops, 1)
  engine.onend?.()
  assert.equal(await completions[0], '导航问题')
  assert.deepEqual(actions, ['start', 'release'])
})

test('提示布局变化失去指针捕获仍持续收音，文档松手正常发送', async (testContext) => {
  const { hold, actions, pointer, target, advance } = setup(testContext)
  hold.pointerDown(pointer())
  const engine = FakeRecognition.latest
  target.captured = false
  dispatchPointer('lostpointercapture', pointer())
  assert.equal(hold.held.value, true)
  assert.equal(engine.aborts, 0)
  engine.result([['提示变化后的问题', true]])
  advance()
  dispatchPointer('pointerup', pointer())
  engine.onend?.()
  await nextTick()
  assert.deepEqual(actions, ['start', 'submit:提示变化后的问题'])
})

test('失去捕获后文档上滑仍可取消，取消后松手不发送', async (testContext) => {
  const { hold, actions, pointer, target } = setup(testContext)
  hold.pointerDown(pointer())
  const engine = FakeRecognition.latest
  target.captured = false
  engine.result([['丢弃问题', true]])
  dispatchPointer('pointermove', pointer(30))
  assert.equal(hold.cancelling.value, true)
  dispatchPointer('pointerup', pointer(30))
  dispatchPointer('pointerup', pointer())
  await nextTick()
  assert.equal(engine.aborts, 1)
  assert.deepEqual(actions, ['start', 'cancel'])
})

test('浏览器真正取消手势会停止收音，卸载后文档事件不再交接', async (testContext) => {
  const { hold, actions, pointer, scope } = setup(testContext, true, true)
  hold.pointerDown(pointer())
  const engine = FakeRecognition.latest
  dispatchPointer('pointercancel', pointer())
  assert.equal(hold.active.value, false)
  assert.equal(engine.aborts, 1)
  scope.stop()
  dispatchPointer('pointerup', pointer())
  assert.deepEqual(actions, ['start', 'cancel'])
})

test('Chat 内按住收音，松开等最终识别结束后才提交一次', async (testContext) => {
  const { hold, actions, pointer, advance, target } = setup(testContext)
  hold.pointerDown(pointer())
  assert.deepEqual(actions, ['start'])
  assert.equal(FakeRecognition.latest.starts, 1)
  advance()
  const engine = FakeRecognition.latest
  assert.equal(engine.continuous, false)
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
  assert.equal(restarted, engine)
  assert.equal(restarted.starts, 2)
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
  engine.onend?.()
  await released
  assert.equal(recognition.error.value, '')
  assert.deepEqual(actions, ['start', 'submit:为什么是斜的'])
})

test('中断直接结束本轮，不重复启动系统识别器', async (testContext) => {
  const { hold, actions, pointer, recognition } = setup(testContext)
  hold.pointerDown(pointer())
  const engine = FakeRecognition.latest
  const lateError = engine.onerror
  engine.onerror?.({ error: 'aborted' })
  await nextTick()
  assert.equal(recognition.listening.value, false)
  assert.equal(engine.aborts, 0)
  assert.equal(recognition.errorCode.value, 'aborted')
  assert.equal(FakeRecognition.latest, engine)
  lateError?.({ error: 'not-allowed' })
  assert.equal(recognition.errorCode.value, 'aborted')
})

test('中断只提示一次且不循环占用麦克风', async (testContext) => {
  const { hold, actions, pointer, recognition } = setup(testContext)
  hold.pointerDown(pointer())
  FakeRecognition.latest.onerror?.({ error: 'aborted' })
  await nextTick()
  assert.equal(hold.active.value, false)
  assert.equal(recognition.listening.value, false)
  assert.equal(actions.filter(action => action.includes('浏览器语音识别已中断')).length, 1)
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
  engine.onend?.()
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

test('首次授权与长按隔离，松手或授权完成均不启动识别或导航', async (testContext) => {
  let finishPermission!: (ready: boolean) => void
  const microphone = {
    ready: shallowRef(false), preparing: shallowRef(false), notice: shallowRef(''),
    prepare: () => new Promise<boolean>(resolve => { finishPermission = resolve }),
  }
  const { hold, pointer, actions, recognition, advance } = setup(testContext, true, true, microphone)
  hold.pointerDown(pointer())
  assert.equal(hold.held.value, false)
  assert.equal(recognition.listening.value, false)
  await hold.pointerUp(pointer())
  microphone.ready.value = true
  finishPermission(true)
  await nextTick()
  assert.deepEqual(actions, ['start', 'cancel'])
  hold.pointerDown(pointer())
  assert.equal(recognition.listening.value, true)
  advance()
  FakeRecognition.latest.result([['重新按住后的问题', true]])
  await hold.pointerUp(pointer())
  FakeRecognition.latest.onend?.()
  assert.deepEqual(actions, ['start', 'cancel', 'start', 'release'])
})

test('授权期间离开页面，迟到授权结果不触发原页面回调', async (testContext) => {
  let finishPermission!: (ready: boolean) => void
  const microphone = {
    ready: shallowRef(false), preparing: shallowRef(false), notice: shallowRef(''),
    prepare: () => new Promise<boolean>(resolve => { finishPermission = resolve }),
  }
  const { hold, pointer, actions, scope } = setup(testContext, true, true, microphone)
  hold.pointerDown(pointer())
  scope.stop()
  finishPermission(false)
  await nextTick()
  assert.deepEqual(actions, ['start'])
})

test('旧实例报错后直接结束本轮，不创建竞争的识别实例', async (testContext) => {
  const { recognition } = setup(testContext)
  recognition.start({ continuous: true })
  const engine = FakeRecognition.latest
  engine.onerror?.({ error: 'aborted' })
  assert.equal(FakeRecognition.latest, engine)
  assert.equal(recognition.listening.value, false)
  assert.equal(recognition.errorCode.value, 'aborted')
  assert.equal(engine.aborts, 0)
})

test('启动无响应超时释放；只有真实 audio-start 才显示收音状态', async (testContext) => {
  const { recognition } = setup(testContext)
  testContext.mock.method(FakeRecognition.prototype, 'start', function (this: FakeRecognition) { this.starts += 1 })
  recognition.start()
  assert.equal(recognition.listening.value, true)
  assert.equal(recognition.audioActive.value, false)
  testContext.mock.timers.tick(8000)
  assert.equal(recognition.listening.value, false)
  assert.equal(recognition.errorCode.value, 'start-timeout')
  recognition.start()
  FakeRecognition.latest.onstart?.()
  assert.equal(recognition.audioActive.value, false)
  FakeRecognition.latest.onaudiostart?.()
  assert.equal(recognition.audioActive.value, true)
  FakeRecognition.latest.result([['私密问题不应出现在诊断记录中', true]])
  FakeRecognition.latest.onaudioend?.()
  assert.equal(recognition.audioActive.value, false)
  const diagnostics = recognition.diagnostics()
  assert.ok(diagnostics.includes('audio-start'))
  assert.ok(diagnostics.includes('result'))
  assert.equal(diagnostics.includes('私密问题'), false)
})

test('不同入口取得同一个控制器，跨轮次复用唯一底层实例', async testContext => {
  const { recognition } = setup(testContext)
  const chat = useBrowserSpeechRecognition()
  const navigation = useBrowserSpeechRecognition()
  assert.equal(chat, navigation)
  assert.equal(chat, recognition)
  assert.equal(navigation.start(), true)
  const engine = FakeRecognition.latest
  assert.equal(chat.start(), false)
  engine.result([['第一轮', true]])
  const completion = navigation.stop()
  engine.onend?.()
  assert.equal(await completion, '第一轮')
  assert.equal(chat.start(), true)
  assert.equal(FakeRecognition.latest, engine)
  assert.equal(engine.starts, 2)
  assert.equal(chat.transcript.value, '')
})

test('取消后等待原生 end，其他入口不能启动；旧回调不会影响新一轮', testContext => {
  const { recognition } = setup(testContext)
  testContext.mock.method(FakeRecognition.prototype, 'abort', function (this: FakeRecognition) { this.aborts += 1 })
  recognition.start()
  const engine = FakeRecognition.latest
  const oldResult = engine.onresult
  recognition.abort()
  const drained = engine.onend
  recognition.abort()
  assert.equal(engine.onend, drained)
  assert.equal(recognition.listening.value, false)
  assert.equal(recognition.busy.value, true)
  assert.equal(useBrowserSpeechRecognition().start(), false)
  assert.equal(engine.starts, 1)
  engine.onend?.()
  assert.equal(recognition.busy.value, false)
  assert.equal(recognition.start(), true)
  drained?.()
  oldResult?.({ resultIndex: 0, results: [{ 0: { transcript: '已取消的旧结果' }, isFinal: true, length: 1 }] })
  assert.equal(recognition.busy.value, true)
  assert.equal(recognition.transcript.value, '')
  assert.equal(FakeRecognition.latest, engine)
})

test('非持有入口卸载不取消另一个入口的收音', testContext => {
  const { recognition } = setup(testContext)
  const idleScope = effectScope()
  const idle = idleScope.run(() => useVoiceHold({ recognition, onError: () => undefined }))!
  recognition.start()
  const engine = FakeRecognition.latest
  idle.cancel()
  idleScope.stop()
  assert.equal(engine.aborts, 0)
  assert.equal(recognition.listening.value, true)
})
