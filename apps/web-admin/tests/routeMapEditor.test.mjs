import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'

const require = createRequire(new URL('../package.json', import.meta.url))
const typescript = require('typescript')
const vue = createRequire(require.resolve('nuxt/package.json'))('vue')

function compileModule(path, dependencies = {}, api = undefined) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8')
  const compiled = typescript.transpileModule(source, {
    compilerOptions: { module: typescript.ModuleKind.CommonJS, target: typescript.ScriptTarget.ES2022 },
  })
  const exports = {}
  const resolve = name => dependencies[name] ?? require(name)
  new Function('require', 'exports', 'useApiClient', compiled.outputText)(resolve, exports, () => api)
  return exports
}

const coordinates = compileModule('../../../packages/ts-shared/src/map-coordinates.ts', {
  './geo': { COORDINATE_SYSTEM: { WGS84: 1, GCJ02: 2, BD09: 3 } },
})
const geometry = compileModule('../app/utils/route-map-geometry.ts', { '@path-seeker/ts-shared': coordinates })
const { routeMapGenerationFeedback } = compileModule('../app/utils/route-map-generation-feedback.ts', { '@/utils/route-map-geometry': geometry })
const snapshot = points => points.map(point => [...point])

function fixture({ missing = false, save = undefined, get = undefined } = {}) {
  let detail = {
    routeId: '9007199254740993', museumId: '2', title: '测试路线', coordinateSystem: 1,
    geometryVersion: 1, geometryStatus: 'ready', confirmed: false, validationMessages: [],
    stations: [1, 2, 3].map(stationNo => ({
      id: String(stationNo), stationNo, title: `站点 ${stationNo}`,
      longitude: 116 + stationNo * 0.001, latitude: 39.9,
    })),
    segments: missing ? [] : [1, 2].map(segmentNo => ({
      id: String(segmentNo), segmentNo, fromStationId: String(segmentNo),
      toStationId: String(segmentNo + 1), sourceType: 2,
      geometryGeoJson: JSON.stringify({ type: 'LineString', coordinates: [
        [116 + segmentNo * 0.001, 39.9], [116 + (segmentNo + 1) * 0.001, 39.9],
      ] }),
    })),
  }
  const requests = []
  const api = { request: async (path, options) => {
    if (path.endsWith('/get')) {
      if (get) await get()
      return structuredClone(detail)
    }
    const body = structuredClone(options.body)
    requests.push(body)
    if (save) await save(body, requests.length)
    detail = {
      ...detail, geometryVersion: detail.geometryVersion + 1,
      segments: [
        ...detail.segments.filter(segment => segment.segmentNo !== body.segmentNo),
        { ...body, id: String(body.segmentNo), sourceType: 2 },
      ],
    }
    return structuredClone(detail)
  } }
  const { useRouteMapEditor } = compileModule('../app/composables/useRouteMapEditor.ts', {
    vue,
    '@/utils/route-map-geometry': geometry,
  }, api)
  const editor = useRouteMapEditor()
  return { editor, requests, load: () => editor.load(detail.routeId), detail: () => structuredClone(detail) }
}

test('unchanged geometry cannot be saved repeatedly, including after reloading', async () => {
  const { editor, requests, load } = fixture()
  await load()
  editor.enterEdit(1)
  assert.equal(editor.canSaveActiveSegment.value, false)
  for (let attempt = 0; attempt < 5; attempt += 1) assert.equal(await editor.saveSegment(), false)
  assert.equal(requests.length, 0)
  editor.addVertex([116.0015, 39.9005])
  assert.equal(await editor.saveSegment(), true)
  assert.equal(editor.canSaveActiveSegment.value, false)
  const savedPoints = editor.segments.value[0].points.map(point => [...point])
  for (let attempt = 0; attempt < 5; attempt += 1) assert.equal(await editor.saveSegment(), false)
  assert.deepEqual(editor.segments.value[0].points, savedPoints)
  await load()
  editor.enterEdit(1)
  assert.equal(await editor.saveSegment(), false)
  assert.equal(await editor.saveAll(), false)
  assert.equal(requests.length, 1)
  assert.equal(requests[0].routeId, '9007199254740993')
})

test('concurrent saves send only one request', async () => {
  let release
  const pending = new Promise(resolve => { release = resolve })
  const { editor, requests, load } = fixture({ save: () => pending })
  await load()
  editor.enterEdit(1)
  editor.addVertex([116.0015, 39.9005])
  const saving = editor.saveSegment()
  assert.equal(editor.saving.value, true)
  assert.equal(await editor.saveSegment(), false)
  assert.equal(await editor.saveAll(), false)
  assert.equal(requests.length, 1)
  release()
  assert.equal(await saving, true)
  assert.equal(editor.saving.value, false)
})

test('batch saves use each segments own geometry and the latest version', async () => {
  const { editor, requests, load } = fixture()
  await load()
  editor.enterEdit(1)
  editor.addVertex([116.0015, 39.9005])
  const firstPoints = snapshot(editor.editingPoints.value)
  editor.exitEdit()
  editor.enterEdit(2)
  editor.addVertex([116.0025, 39.901])
  const secondPoints = snapshot(editor.editingPoints.value)
  assert.equal(await editor.saveAll(), true)
  assert.deepEqual(JSON.parse(requests[0].geometryGeoJson).coordinates, firstPoints)
  assert.deepEqual(JSON.parse(requests[1].geometryGeoJson).coordinates, secondPoints)
  assert.deepEqual(requests.map(request => request.geometryVersion), [1, 2])
  assert.equal(editor.hasDirty.value, false)
})

test('saving an inactive segment does not submit the active segments vertices', async () => {
  const { editor, requests, load } = fixture()
  await load()
  editor.enterEdit(1)
  editor.addVertex([116.0015, 39.9005])
  const firstPoints = snapshot(editor.editingPoints.value)
  editor.exitEdit()
  editor.enterEdit(2)
  editor.addVertex([116.0025, 39.901])
  const secondPoints = snapshot(editor.editingPoints.value)
  assert.equal(await editor.saveSegment(1), true)
  assert.deepEqual(JSON.parse(requests[0].geometryGeoJson).coordinates, firstPoints)
  assert.deepEqual(editor.editingPoints.value, secondPoints)
  assert.equal(editor.activeSegment.value.dirty, true)
})

test('failed saves retain the draft and allow retry', async () => {
  const { editor, requests, load } = fixture({ save: async (_, count) => {
    if (count === 1) throw new Error('规划失败')
  } })
  await load()
  editor.enterEdit(1)
  editor.addVertex([116.0015, 39.9005])
  const points = snapshot(editor.editingPoints.value)
  assert.equal(await editor.saveSegment(), false)
  assert.equal(editor.saving.value, false)
  assert.equal(editor.canSaveActiveSegment.value, true)
  assert.deepEqual(editor.editingPoints.value, points)
  assert.equal(await editor.saveSegment(), true)
  assert.equal(requests.length, 2)
})

test('batch failures retain remaining drafts and retry only unsaved segments', async () => {
  const { editor, requests, load } = fixture({ save: async (_, count) => {
    if (count === 2) throw new Error('保存失败')
  } })
  await load()
  editor.enterEdit(1)
  editor.addVertex([116.0015, 39.9005])
  editor.exitEdit()
  editor.enterEdit(2)
  editor.addVertex([116.0025, 39.901])
  assert.equal(await editor.saveAll(), false)
  assert.deepEqual(editor.dirtySegments.value.map(segment => segment.segmentNo), [2])
  assert.equal(editor.saving.value, false)
  assert.equal(await editor.saveAll(), true)
  assert.deepEqual(requests.map(request => request.segmentNo), [1, 2, 2])
})

test('a missing segment can still be saved as an initial straight line', async () => {
  const { editor, requests, load } = fixture({ missing: true })
  await load()
  editor.enterEdit(1)
  assert.equal(editor.canSaveActiveSegment.value, true)
  assert.equal(await editor.saveSegment(), true)
  assert.equal(editor.canSaveActiveSegment.value, false)
  assert.equal(await editor.saveSegment(), false)
  assert.equal(requests.length, 1)
})

test('undo and redo stay with their own segment and preserve coordinate precision', async () => {
  const { editor, load } = fixture()
  await load()
  editor.enterEdit(1)
  const firstOriginal = snapshot(editor.editingPoints.value)
  editor.addVertex([116.001512345678, 39.900512345678])
  const firstDraft = snapshot(editor.editingPoints.value)
  editor.enterEdit(2)
  assert.equal(editor.canUndo.value, false)
  editor.undo()
  assert.equal(editor.editingPoints.value[0][0], 116.002)
  editor.addVertex([116.0025, 39.901])
  editor.undo()
  assert.equal(editor.activeSegment.value.dirty, false)
  editor.enterEdit(1)
  editor.undo()
  assert.deepEqual(editor.editingPoints.value, firstOriginal)
  editor.redo()
  assert.deepEqual(editor.editingPoints.value, firstDraft)
  assert.equal(editor.editingPoints.value[1][0], 116.001512345678)
})

test('discarding a missing segments draft restores usable endpoints', async () => {
  const { editor, load } = fixture({ missing: true })
  await load()
  assert.equal(editor.editingPoints.value.length, 2)
  assert.equal(editor.previewPointsBySegmentNo.value[1].length, 2)
  editor.addVertex([116.0015, 39.9005])
  editor.discardActive()
  assert.equal(editor.editingPoints.value.length, 2)
  editor.addVertex([116.0015, 39.9005])
  assert.equal(editor.editingPoints.value.length, 3)
  assert.equal(await editor.saveSegment(), true)
})

test('validation and station metadata responses preserve all unsaved drafts', async () => {
  const { editor, load, detail } = fixture()
  await load()
  editor.addVertex([116.0015, 39.9005])
  const draft = snapshot(editor.editingPoints.value)
  const result = detail()
  result.stations[0].arrivalNote = '集合点'
  editor.applyPreservingDrafts(result)
  assert.deepEqual(editor.editingPoints.value, draft)
  assert.equal(editor.stations.value[0].arrivalNote, '集合点')
  assert.equal(editor.activeSegment.value.dirty, true)
  assert.equal(editor.canUndo.value, true)
})

test('moving a station keeps intermediate draft points and updates both neighboring endpoints', async () => {
  const { editor, load, detail } = fixture()
  await load()
  editor.addVertex([116.0015, 39.9005])
  editor.enterEdit(2)
  editor.addVertex([116.0025, 39.9008])
  const result = detail()
  result.stations[1].longitude += 0.0003
  result.segments.forEach(segment => { segment.status = 0 })
  editor.applyPreservingDrafts(result)
  const first = editor.segments.value[0]
  const second = editor.segments.value[1]
  assert.equal(first.points[1][0], 116.0015)
  assert.equal(second.points[1][0], 116.0025)
  assert.equal(first.points.at(-1)[0], result.stations[1].longitude)
  assert.equal(second.points[0][0], result.stations[1].longitude)
  assert.equal(await editor.saveAll(), true)
})

test('invalidated saved segments can be repaired even before editing', async () => {
  const { editor, load, detail } = fixture()
  await load()
  const result = detail()
  result.segments[0].status = 0
  editor.applyDetail(result)
  assert.equal(editor.canSaveActiveSegment.value, true)
  assert.equal(await editor.saveSegment(), true)
})

test('GCJ-02 editing renders WGS84 handles and preserves untouched stored coordinates', async () => {
  const { editor, load, detail, requests } = fixture()
  await load()
  const result = detail()
  result.coordinateSystem = 2
  result.stations.forEach(station => { station.coordinateSystem = 2 })
  editor.applyDetail(result)
  const start = geometry.routePointToWgs84([result.stations[0].longitude, result.stations[0].latitude], 2)
  assert.deepEqual(editor.editingPoints.value[0], start)
  assert.deepEqual([editor.stations.value[0].longitude, editor.stations.value[0].latitude], start)
  editor.addVertex([116.0015, 39.9005])
  assert.equal(await editor.saveSegment(), true)
  const saved = JSON.parse(requests[0].geometryGeoJson).coordinates
  assert.deepEqual(saved[0], [result.stations[0].longitude, result.stations[0].latitude])
  assert.deepEqual(saved.at(-1), [result.stations[1].longitude, result.stations[1].latitude])
  assert.deepEqual(saved[1], geometry.routePointFromWgs84([116.0015, 39.9005], 2))
})

test('cancelled or out-of-order loads cannot overwrite a newer route', async () => {
  const pending = new Map()
  const { useRouteMapEditor } = compileModule('../app/composables/useRouteMapEditor.ts', {
    vue, '@/utils/route-map-geometry': geometry,
  }, { request: (_, options) => new Promise(resolve => { pending.set(options.query.routeId, resolve) }) })
  const editor = useRouteMapEditor()
  const first = editor.load('first')
  const second = editor.load('second')
  const response = routeId => ({ routeId, coordinateSystem: 1, geometryVersion: 1, stations: [], segments: [] })
  pending.get('second')(response('second'))
  await second
  pending.get('first')(response('first'))
  assert.equal(await first, null)
  assert.equal(editor.detail.value.routeId, 'second')
  const third = editor.load('third')
  editor.cancelLoad()
  pending.get('third')(response('third'))
  assert.equal(await third, null)
  assert.equal(editor.detail.value, null)
})

test('a forced reload failure keeps the existing draft available', async () => {
  let fail = false
  const { editor, load, detail } = fixture({ get: () => { if (fail) throw new Error('network disconnected') } })
  await load()
  editor.addVertex([116.0015, 39.9005])
  const draft = snapshot(editor.editingPoints.value)
  fail = true
  assert.equal(await editor.load(detail().routeId, true), null)
  assert.equal(editor.error.value, 'network disconnected')
  assert.equal(editor.loading.value, false)
  assert.deepEqual(editor.editingPoints.value, draft)
  assert.equal(editor.hasDirty.value, true)
})

test('reopening an invalidated segment pins its endpoints to the moved stations', async () => {
  const { editor, load, detail, requests } = fixture()
  await load()
  const moved = detail()
  moved.stations[1].longitude += 0.003
  moved.segments[0].status = 0
  moved.segments[1].status = 0
  editor.applyDetail(moved)
  assert.equal(editor.hasDirty.value, true)
  assert.deepEqual(editor.segments.value[0].points.at(-1), [moved.stations[1].longitude, moved.stations[1].latitude])
  assert.equal(await editor.saveSegment(1), true)
  const points = JSON.parse(requests[0].geometryGeoJson).coordinates
  assert.deepEqual(points.at(-1), [moved.stations[1].longitude, moved.stations[1].latitude])
})

test('undo after a station move cannot restore obsolete fixed endpoints', async () => {
  const { editor, load, detail } = fixture()
  await load()
  editor.addVertex([116.0015, 39.9005])
  const moved = detail()
  moved.stations[1].longitude += 0.003
  moved.segments[0].status = 0
  editor.applyPreservingDrafts(moved)
  editor.undo()
  assert.deepEqual(editor.editingPoints.value.at(-1), [moved.stations[1].longitude, moved.stations[1].latitude])
  editor.redo()
  assert.deepEqual(editor.editingPoints.value.at(-1), [moved.stations[1].longitude, moved.stations[1].latitude])
})

test('single segment generation distinguishes success from an incomplete whole route', () => {
  const { detail } = fixture()
  const result = detail()
  result.segments.forEach(segment => { segment.status = 1 })
  result.geometryStatus = 'station_only'
  result.validationMessages = ['第 2 段（站点 2 → 站点 3）：入口已调整']
  const feedback = routeMapGenerationFeedback(result, 1)
  assert.equal(feedback.tone, 'info')
  assert.match(feedback.title, /第 1 段已生成/)
  assert.match(feedback.description, /第 2 段/)
})

test('a fully generated route is reported as ready for confirmation', () => {
  const { detail } = fixture()
  const result = detail()
  result.segments.forEach(segment => { segment.status = 1 })
  const feedback = routeMapGenerationFeedback(result, 1)
  assert.equal(feedback.tone, 'success')
  assert.match(feedback.description, /可以确认路线/)
})

test('invalid automatic geometry never gets a generation success message', () => {
  const { detail } = fixture()
  const result = detail()
  result.segments[0].sourceType = 1
  result.segments[0].status = 1
  result.segments[0].validationMessage = '终点未连接当前站点入口'
  const feedback = routeMapGenerationFeedback(result, 1)
  assert.equal(feedback.tone, 'info')
  assert.match(feedback.description, /终点/)
})

test('automatic source does not hide segment validation failures', async () => {
  const { editor, detail, load } = fixture()
  await load()
  const result = detail()
  result.segments[1].sourceType = 1
  result.segments[1].status = 0
  result.segments[1].validationMessage = '入口已调整，请重新生成'
  editor.applyDetail(result)
  assert.equal(editor.segments.value[1].serverSourceType, 1)
  assert.equal(editor.segments.value[1].serverValidationMessage, '入口已调整，请重新生成')
  assert.equal(editor.segments.value[0].serverValidationMessage, '')
})
