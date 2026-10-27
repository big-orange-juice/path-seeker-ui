import test, { type TestContext } from 'node:test'
import assert from 'node:assert/strict'
import { createRoomEchoGuard } from '../src/utils/roomEchoGuard.ts'

function browsers(context: TestContext) {
  const values = new Map<string, string>()
  const tabs: EventTarget[] = []
  const original = Object.getOwnPropertyDescriptor(globalThis, 'window')
  context.after(() => {
    if (original) Object.defineProperty(globalThis, 'window', original)
    else Reflect.deleteProperty(globalThis, 'window')
  })
  context.mock.timers.enable({ apis: ['setInterval'] })
  return {
    values,
    tab(changes: boolean[]) {
      const browser = new EventTarget()
      const notify = (key: string) => {
        for (const tab of tabs) if (tab !== browser) tab.dispatchEvent(Object.assign(new Event('storage'), { key }))
      }
      const storage = {
        get length() { return values.size },
        key: (index: number) => [...values.keys()][index] ?? null,
        getItem: (key: string) => values.get(key) ?? null,
        setItem(key: string, value: string) { values.set(key, value); notify(key) },
        removeItem(key: string) { values.delete(key); notify(key) },
      }
      Object.assign(browser, { localStorage: storage })
      tabs.push(browser)
      Object.defineProperty(globalThis, 'window', { configurable: true, value: browser })
      const guard = createRoomEchoGuard(active => changes.push(active))
      context.after(() => guard.dispose())
      return { guard, browser }
    },
  }
}

test('host capture blocks existing and newly opened local listener tabs until the last capture ends', context => {
  const fixture = browsers(context)
  const changes: boolean[] = []
  const listener = fixture.tab(changes).guard
  const host = fixture.tab([]).guard
  const first = host.capture()
  assert.equal(listener.isCapturing(), true)
  assert.deepEqual(changes, [true])
  const newlyOpened = fixture.tab([]).guard
  assert.equal(newlyOpened.isCapturing(), true)
  const next = host.capture()
  first()
  first()
  assert.equal(listener.isCapturing(), true)
  next()
  assert.equal(listener.isCapturing(), false)
  assert.equal(newlyOpened.isCapturing(), false)
  assert.deepEqual(changes, [true, false])
  assert.equal(fixture.values.size, 0)
})

test('closing one capturing tab preserves other microphones and page restore republishes its lease', context => {
  const fixture = browsers(context)
  const listener = fixture.tab([]).guard
  const first = fixture.tab([])
  const second = fixture.tab([]).guard
  first.guard.capture()
  const stop = second.capture()
  first.browser.dispatchEvent(new Event('pagehide'))
  assert.equal(listener.isCapturing(), true)
  stop()
  assert.equal(listener.isCapturing(), false)
  first.browser.dispatchEvent(new Event('pageshow'))
  assert.equal(listener.isCapturing(), true)
  first.guard.dispose()
  assert.equal(listener.isCapturing(), false)
})

test('expired capture leases recover from a crashed page and recording renews live leases', context => {
  let now = 1000
  context.mock.method(Date, 'now', () => now)
  const fixture = browsers(context)
  const listener = fixture.tab([]).guard
  const host = fixture.tab([]).guard
  host.capture()
  now += 14000
  context.mock.timers.tick(2000)
  now += 14000
  assert.equal(listener.isCapturing(), true)
  now += 1001
  assert.equal(listener.isCapturing(), false)
})

test('unavailable storage retains local microphone protection without preventing capture', context => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'window')
  const browser = new EventTarget()
  Object.defineProperty(browser, 'localStorage', { get() { throw Error('Storage disabled') } })
  Object.defineProperty(globalThis, 'window', { configurable: true, value: browser })
  const guard = createRoomEchoGuard(() => {})
  context.after(() => {
    guard.dispose()
    if (original) Object.defineProperty(globalThis, 'window', original)
    else Reflect.deleteProperty(globalThis, 'window')
  })
  const stop = guard.capture()
  assert.equal(guard.isCapturing(), true)
  stop()
  assert.equal(guard.isCapturing(), false)
})
