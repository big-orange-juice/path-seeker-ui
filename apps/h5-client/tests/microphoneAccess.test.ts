import test from 'node:test'
import assert from 'node:assert/strict'
import { useMicrophoneAccess } from '../src/composables/useMicrophoneAccess.ts'

function setup(testContext: any, getUserMedia: () => Promise<unknown>) {
  const previousWindow = globalThis.window
  const previousNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
  Object.assign(globalThis, { window: { isSecureContext: true } })
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { mediaDevices: { getUserMedia } } })
  const microphone = useMicrophoneAccess()
  microphone.ready.value = false
  microphone.notice.value = ''
  testContext.after(() => {
    Object.assign(globalThis, { window: previousWindow })
    if (previousNavigator) Object.defineProperty(globalThis, 'navigator', previousNavigator)
    else Reflect.deleteProperty(globalThis, 'navigator')
  })
  return microphone
}

test('申请期间复用同一请求，授权成功立即停止所有轨道，不占用识别麦克风', async testContext => {
  let complete!: (stream: unknown) => void
  let requests = 0
  let stopped = 0
  const microphone = setup(testContext, () => {
    requests += 1
    return new Promise(resolve => { complete = resolve })
  })
  const first = microphone.prepare()
  const second = microphone.prepare()
  assert.equal(first, second)
  assert.equal(microphone.preparing.value, true)
  complete({ getAudioTracks: () => [{ readyState: 'live' }], getTracks: () => [{ stop() { stopped += 1 } }] })
  assert.equal(await first, true)
  assert.equal(requests, 1)
  assert.equal(stopped, 1)
  assert.equal(microphone.ready.value, true)
  assert.equal(microphone.preparing.value, false)
})

test('权限拒绝和设备占用分别提示，不把识别服务故障归为麦克风拒绝', async testContext => {
  let name = 'NotAllowedError'
  const microphone = setup(testContext, async () => { throw new DOMException('', name) })
  assert.equal(await microphone.prepare(), false)
  assert.match(microphone.notice.value, /权限/)
  name = 'NotReadableError'
  assert.equal(await microphone.prepare(), false)
  assert.match(microphone.notice.value, /通话或录音/)
  assert.equal(microphone.ready.value, false)
  assert.equal(microphone.preparing.value, false)
})

test('不安全页面退出授权状态，恢复 HTTPS 后可重新授权', async testContext => {
  let requests = 0
  const microphone = setup(testContext, async () => { requests += 1; throw new DOMException('', 'NotAllowedError') })
  Object.assign(window, { isSecureContext: false })
  assert.equal(await microphone.prepare(), false)
  assert.match(microphone.notice.value, /HTTPS/)
  assert.equal(requests, 0)
  Object.assign(window, { isSecureContext: true })
  assert.equal(await microphone.prepare(), false)
  assert.equal(requests, 1)
})
