import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'

const require = createRequire(new URL('../package.json', import.meta.url))
const typescript = require('typescript')
const vue = createRequire(require.resolve('nuxt/package.json'))('vue')
const roomId = '9007199254740993'
const otherRoomId = '9007199254740995'
const timestamp = Date.parse('2026-11-03T12:00:00Z')
const settled = () => new Promise(resolve => setImmediate(resolve))

function compile(source, dependencies, bindings = {}) {
  const compiled = typescript.transpileModule(source, {
    compilerOptions: { module: typescript.ModuleKind.CommonJS, target: typescript.ScriptTarget.ES2022 },
  })
  const exports = {}
  new Function('require', 'exports', ...Object.keys(bindings), compiled.outputText)(
    name => dependencies[name] ?? {}, exports, ...Object.values(bindings),
  )
  return exports
}

function record(id, minutesAgo = 10, overrides = {}) {
  return {
    id, roomId, userId: '9007199254740997', longitude: 116.44, latitude: 39.97,
    accuracy: 30, coordinateSystem: 'GCJ-02',
    sampledAt: new Date(timestamp - minutesAgo * 60000).toISOString(),
    receivedAt: new Date(timestamp - minutesAgo * 60000).toISOString(), ...overrides,
  }
}

function page(list = [], overrides = {}) {
  return { list, hasMore: false, nextAfterId: null, ...overrides }
}

function historyFixture(request) {
  const mounted = []
  const unmount = []
  const intervals = []
  const events = new Map()
  const document = {
    hidden: false,
    addEventListener: (name, handler) => events.set(name, handler),
    removeEventListener: name => events.delete(name),
  }
  const source = readFileSync(new URL('../app/composables/useDriverLocationHistory.ts', import.meta.url), 'utf8')
  const { useDriverLocationHistory } = compile(source, {
    vue: { ...vue, onMounted: handler => mounted.push(handler), onBeforeUnmount: handler => unmount.push(handler) },
    '@/composables/useApiClient': { useApiClient: () => ({ request }), resolveApiErrorMessage: error => error.message },
  }, { document, setInterval: handler => { intervals.push(handler); return 1 }, clearInterval: () => {} })
  const selected = vue.shallowRef()
  const clock = { now: timestamp }
  const scope = vue.effectScope()
  const model = scope.run(() => useDriverLocationHistory(selected, () => clock.now))
  mounted.forEach(handler => handler())
  return {
    model, selected, document, clock, intervals, events,
    dispose: () => { unmount.forEach(handler => handler()); scope.stop() },
  }
}

test('selection fetches every history page with a fixed hour window and exact string IDs', async () => {
  const requests = []
  const fixture = historyFixture(async (_, options) => {
    requests.push(options)
    return requests.length === 1
      ? page([record('3', 5), record('2', 30)], { hasMore: true, nextAfterId: '9007199254740999' })
      : page([record('2', 30), record('1', 60), record('old', 61), record('future', -1),
        record('invalid', 20, { latitude: NaN }), record('wrong-room', 20, { roomId: otherRoomId })])
  })
  assert.equal(requests.length, 0)
  fixture.selected.value = { roomId }
  await settled()
  assert.equal(requests.length, 2)
  assert.equal(requests[0].query.roomId, roomId)
  assert.equal(requests[1].query.afterId, '9007199254740999')
  assert.equal(requests[0].query.from, '2026-11-03T11:00:00.000Z')
  assert.equal(requests[0].query.to, '2026-11-03T12:00:00.000Z')
  assert.equal(requests[1].query.from, requests[0].query.from)
  assert.equal(requests[1].query.to, requests[0].query.to)
  assert.deepEqual(fixture.model.points.value.map(point => point.id), ['1', '2', '3'])
  fixture.dispose()
})

test('switching rooms cancels old requests and rejects late results without unlocking the new request', async () => {
  const requests = []
  const fixture = historyFixture((_, options) => new Promise(resolve => requests.push({ options, resolve })))
  fixture.selected.value = { roomId }
  fixture.selected.value = { roomId: otherRoomId }
  assert.equal(requests[0].options.signal.aborted, true)
  requests[0].resolve(page([record('old')]))
  await settled()
  assert.equal(fixture.model.pending.value, true)
  assert.deepEqual(fixture.model.points.value, [])
  requests[1].resolve(page([record('new', 5, { roomId: otherRoomId })]))
  await settled()
  assert.equal(fixture.model.points.value[0].id, 'new')
  fixture.selected.value = undefined
  assert.deepEqual(fixture.model.points.value, [])
  fixture.dispose()
})

test('failed refresh keeps unexpired history and can be retried, including an empty result', async () => {
  let fail = false
  let result = page([record('expired-soon', 59.9), record('recent')])
  const fixture = historyFixture(async () => { if (fail) throw new Error('网络不可用'); return result })
  fixture.selected.value = { roomId }
  await settled()
  fixture.clock.now += 15000
  fail = true
  await fixture.model.refresh()
  assert.equal(fixture.model.error.value, '网络不可用')
  assert.deepEqual(fixture.model.points.value.map(point => point.id), ['recent'])
  fail = false
  result = page()
  await fixture.model.refresh()
  assert.equal(fixture.model.error.value, '')
  assert.deepEqual(fixture.model.points.value, [])
  fixture.dispose()
})

test('refresh pauses while hidden, resumes on visibility, and cancels on unmount', async () => {
  const requests = []
  const fixture = historyFixture((_, options) => new Promise(resolve => requests.push({ options, resolve })))
  fixture.document.hidden = true
  fixture.selected.value = { roomId }
  fixture.intervals[0]()
  assert.equal(requests.length, 0)
  fixture.document.hidden = false
  fixture.events.get('visibilitychange')()
  await fixture.model.refresh()
  assert.equal(requests.length, 1)
  fixture.dispose()
  assert.equal(requests[0].options.signal.aborted, true)
  requests[0].resolve(page([record('late')]))
  await settled()
  assert.deepEqual(fixture.model.points.value, [])
  assert.equal(fixture.events.size, 0)
})

test('repeated pagination cursors stop with a recoverable error', async () => {
  let calls = 0
  const fixture = historyFixture(async () => { calls += 1; return page([], { hasMore: true, nextAfterId: '123' }) })
  fixture.selected.value = { roomId }
  await settled()
  assert.equal(calls, 2)
  assert.match(fixture.model.error.value, /分页/)
  assert.equal(fixture.model.pending.value, false)
  fixture.dispose()
})

test('map focuses after SDK loading, refocuses the same room, and preserves viewport during refresh', async () => {
  const mounted = []
  const unmount = []
  const focusCalls = []
  const fitCalls = []
  const overlays = new Set()
  const map = {
    add: overlay => overlays.add(overlay), remove: overlay => overlays.delete(overlay),
    setZoomAndCenter: (...args) => focusCalls.push(args), setFitView: (...args) => fitCalls.push(args),
    destroy: () => overlays.clear(),
  }
  class Marker {
    constructor(options) { this.options = options }
    on() {}
    setPosition() {}
    setzIndex() {}
  }
  class Polyline { constructor(options) { this.options = options } }
  let ready
  const sdk = new Promise(resolve => { ready = resolve })
  const props = vue.reactive({
    rows: [{ roomId, roomCode: '85631374', longitude: 116.44, latitude: 39.97, status: 'online' }],
    selectedId: roomId, focusRequest: 1, history: [record('1', 20), record('2', 10)],
    historyPending: false, historyError: '',
  })
  const source = readFileSync(new URL('../app/components/driver-locations/DriverLocationMap.vue', import.meta.url), 'utf8')
    .split('<script setup lang="ts">')[1].split('</script>')[0]
  const scope = vue.effectScope()
  scope.run(() => compile(source, {
    vue: { ...vue, useTemplateRef: () => ({ value: {} }), onMounted: handler => mounted.push(handler), onBeforeUnmount: handler => unmount.push(handler) },
    '@/utils/amap': { loadAdminAMap: () => sdk },
    '@/types/driver-location': { driverStatusLabels: { online: '在线' } },
  }, {
    defineProps: () => props, defineEmits: () => () => {}, useRuntimeConfig: () => ({ public: {} }),
    document: { createElement: () => ({}) },
    ResizeObserver: class { observe() {} disconnect() {} },
  }))
  const mounting = mounted[0]()
  props.focusRequest += 1
  await vue.nextTick()
  ready({ Map: function () { return map }, Marker, Polyline })
  await mounting
  assert.deepEqual(focusCalls, [[17, [116.44, 39.97]]])
  const initialFits = fitCalls.length
  const line = [...overlays].find(overlay => overlay instanceof Polyline)
  assert.deepEqual(line.options.path, [[116.44, 39.97], [116.44, 39.97]])
  props.focusRequest += 1
  await vue.nextTick()
  assert.equal(focusCalls.length, 2)
  props.rows = [{ ...props.rows[0], longitude: 116.45 }]
  props.history = [record('3', 5)]
  await vue.nextTick()
  assert.equal(focusCalls.length, 2)
  assert.equal(fitCalls.length, initialFits)
  assert.equal([...overlays].some(overlay => overlay instanceof Polyline), false)
  props.selectedId = otherRoomId
  props.history = []
  await vue.nextTick()
  assert.equal(overlays.size, 1)
  unmount.forEach(handler => handler())
  scope.stop()
  assert.equal(overlays.size, 0)
})
