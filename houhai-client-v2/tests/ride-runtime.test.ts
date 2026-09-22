import assert from 'node:assert/strict'
import test from 'node:test'
import { createRenderer, nextTick } from 'vue'
import { useRide } from '../src/ride/useRide.ts'

test('ride lifecycle preserves pause, confirms GPS dwell, queues latest stop and cleans up stale callbacks', async () => {
  const originalGlobals = new Map(['window', 'document', 'navigator', 'localStorage', 'SpeechSynthesisUtterance'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
  let success: PositionCallback | undefined
  let interval: (() => void) | undefined
  let spoken: { text: string; onstart?: () => void; onend?: () => void } | undefined
  let playCount = 0
  let resumeCount = 0
  const storage = new Map<string, string>()
  const mockedGlobals = {
    window: {
      location: { search: '?routeId=2096000000000000001&lang=en' },
      setInterval(callback: () => void) { interval = callback; return 1 },
      clearInterval() { interval = undefined },
      speechSynthesis: {
        getVoices: () => [{ lang: 'en-US' }, { lang: 'zh-CN' }, { lang: 'ru-RU' }, { lang: 'es-ES' }],
        speak(utterance: typeof spoken) { spoken = utterance; playCount += 1; utterance?.onstart?.() },
        pause() {}, resume() { resumeCount += 1 }, cancel() {}, removeEventListener() {},
      },
    },
    document: { documentElement: { lang: '' }, title: '' },
    navigator: { geolocation: { getCurrentPosition(callback: PositionCallback) { success = callback } } },
    localStorage: { getItem: (key: string) => storage.get(key), setItem: (key: string, value: string) => storage.set(key, value) },
    SpeechSynthesisUtterance: class { text: string; constructor(text: string) { this.text = text } },
  }
  for (const [key, value] of Object.entries(mockedGlobals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  const renderer = createRenderer({
    patchProp() {}, insert() {}, remove() {}, createElement: () => ({}), createText: () => ({}), createComment: () => ({}),
    setText() {}, setElementText() {}, parentNode: () => null, nextSibling: () => null,
  })
  let ride!: ReturnType<typeof useRide>
  const app = renderer.createApp({ setup() { ride = useRide(); return () => null } })
  try {
    app.mount({})
    assert.equal(ride.locale.value, 'en')
    await ride.enter('en')
    assert.equal(ride.selectedId.value, '2096000000000000001')
    assert.equal(ride.page.value, 'map')
    assert.equal(playCount, 0)
    ride.start()
    assert.equal(ride.page.value, 'journey')
    assert.equal(playCount, 1)
    const route = ride.active.value!
    async function locate(index: number, timestamp: number, accuracy = 10) {
      interval?.()
      const coordinate = route.stops[index].coordinate!
      success!({ coords: { longitude: coordinate[0], latitude: coordinate[1], accuracy }, timestamp } as GeolocationPosition)
      await nextTick()
    }
    const now = Date.now()
    await locate(1, now - 4000)
    assert.equal(ride.arrived.value, undefined)
    await locate(1, now - 2000)
    assert.equal(ride.arrived.value?.id, route.stops[1].id)
    assert.equal(ride.playback.value.current, 0)
    assert.equal(playCount, 1)
    await locate(1, now - 1000)
    assert.equal(playCount, 1)
    ride.togglePlayback()
    assert.equal(ride.playback.value.status, 'paused')
    ride.page.value = 'map'
    ride.selectedId.value = ride.routes.value[2].id
    assert.equal(ride.active.value?.id, route.id)
    assert.equal(playCount, 1)
    await locate(2, now - 2000)
    await locate(2, now)
    assert.equal(ride.playback.value.pending, 2)
    assert.equal(ride.playback.value.status, 'paused')
    ride.selectedId.value = route.id
    ride.start()
    assert.equal(ride.playback.value.status, 'paused')
    assert.equal(playCount, 1)
    ride.togglePlayback()
    assert.equal(playCount, 1)
    assert.ok(resumeCount > 0)
    spoken!.onend!()
    assert.equal(ride.playback.value.current, 2)
    assert.equal(playCount, 2)
    await locate(3, now - 2000, 500)
    await locate(3, now, 500)
    assert.equal(ride.playback.value.pending, undefined)
    interval?.()
    const staleCallback = success!
    ride.end()
    assert.equal(ride.active.value, undefined)
    assert.equal(ride.location.state.value, 'idle')
    staleCallback({ coords: { longitude: 116, latitude: 39, accuracy: 10 }, timestamp: now } as GeolocationPosition)
    await nextTick()
    assert.equal(ride.location.location.value, undefined)
    assert.equal(interval, undefined)
  } finally {
    app.unmount()
    for (const [key, descriptor] of originalGlobals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else Reflect.deleteProperty(globalThis, key)
    }
  }
})
