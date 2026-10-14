import { watchLocation } from './watchLocation.rewritten.ts'

/**
 * 临时验证脚本（不属于仓库测试）：验证 watchLocation 的取数策略。
 *
 * 用假的 navigator.geolocation 复现现场行为：enableHighAccuracy=true 的请求静默挂起
 * （不回调也不报错），enableHighAccuracy=false 的请求立即返回 9 米定位。
 * 期望结论：首帧由非高精度请求给出，且拿到足够精度后关闭高精度通道。
 * 另覆盖两条降级路径：权限被拒只上报一次；位置不可用时改用高精度重试一次。
 */

const listeners: Array<{ options: any; ok: (p: any) => void; fail: (e: any) => void; cleared: boolean }> = []

function makePosition(accuracy: number) {
  return { coords: { longitude: 116.366021, latitude: 39.934567, accuracy, heading: Number.NaN, speed: 0, altitude: 46 }, timestamp: Date.now() }
}

const failUpgrade = { value: false }

const fakeGeolocation = {
  watchPosition(ok: (p: any) => void, fail: (e: any) => void, options: any) {
    const entry = { options, ok, fail, cleared: false }
    listeners.push(entry)
    const id = listeners.length
    // 模拟现场：强制高精度时浏览器不给任何回调
    if (options.enableHighAccuracy !== true) {
      setTimeout(() => { if (!entry.cleared) ok(makePosition(9)) }, 0)
    } else if (failUpgrade.value) {
      setTimeout(() => { if (!entry.cleared) fail({ code: 2, message: 'unavailable' }) }, 0)
    }
    return id
  },
  getCurrentPosition(ok: (p: any) => void, _fail: (e: any) => void, options: any) {
    setTimeout(() => { ok(makePosition(options?.enableHighAccuracy ? 20 : 12)) }, 0)
  },
  clearWatch(id: number) {
    const entry = listeners[id - 1]
    if (entry) entry.cleared = true
  },
}

Object.defineProperty(globalThis, 'navigator', { value: { geolocation: fakeGeolocation }, configurable: true })

function assertEqual(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) throw new Error(`${label}: expected ${String(expected)}, got ${String(actual)}`)
  console.log(`ok - ${label}`)
}

// 场景一：非高精度请求给出首帧，高精度通道在精度达标后被关闭
{
  listeners.length = 0
  const fixes: number[] = []
  const handle = watchLocation({ onFix: fix => fixes.push(fix.accuracy) })
  await new Promise(resolve => setTimeout(resolve, 10))
  assertEqual(fixes.length, 1, '首帧在非高精度请求上立即返回')
  assertEqual(fixes[0], 9, '首帧精度为 9 米')
  assertEqual(listeners.length, 2, '同时开启了高精度改善通道')
  assertEqual(listeners[1].cleared, true, '精度达标后关闭高精度通道')
  handle.stop()
  assertEqual(listeners[0].cleared, true, '停止后关闭首帧通道')
}

// 场景二：权限被拒只上报一次
{
  listeners.length = 0
  const errors: string[] = []
  const handle = watchLocation({ onFix: () => {}, onError: error => errors.push(error.code) })
  listeners[0].fail({ code: 1, message: 'denied' })
  listeners[1].fail({ code: 1, message: 'denied' })
  await new Promise(resolve => setTimeout(resolve, 10))
  assertEqual(errors.join(','), 'denied', '权限被拒只上报一次')
  handle.stop()
}

// 场景三：粗定位通道报"位置不可用"、且高精度改善通道已自行退出时，改用高精度重试一次
{
  listeners.length = 0
  const fixes: number[] = []
  const handle = watchLocation({ onFix: fix => fixes.push(fix.accuracy) })
  // 改善通道先自己报不可用并关闭（watchLocation 会清掉它）
  failUpgrade.value = true
  listeners[1].fail({ code: 2, message: 'unavailable' })
  failUpgrade.value = false
  listeners[0].fail({ code: 2, message: 'unavailable' })
  await new Promise(resolve => setTimeout(resolve, 10))
  const retry = listeners.find(entry => entry.options.maximumAge === 30000)
  if (!retry) throw new Error('重试请求未发出')
  assertEqual(retry.options.enableHighAccuracy, true, '重试改为强制高精度')
  assertEqual(retry.options.maximumAge, 30000, '重试放宽缓存时长')
  // 强制高精度的重试请求本身也需要定位，这里模拟它最终给出定位
  retry.ok(makePosition(25))
  assertEqual(fixes.length, 1, '重试后拿到定位')
  assertEqual(fixes[0], 25, '重试定位被采纳')
  handle.stop()
}

console.log('watchLocation 策略验证通过')
