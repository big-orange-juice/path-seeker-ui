import assert from 'node:assert/strict'
import test from 'node:test'
import { mockDatabase } from '../src/data/mock.ts'

test('所有业务主键保持字符串类型', () => {
  const ids = [
    ...mockDatabase.destinations.map(item => item.id),
    ...mockDatabase.places.flatMap(item => [item.id, item.destinationId, ...item.narrations.flatMap(narration => [narration.id, narration.guideId])]),
    ...mockDatabase.routes.flatMap(item => [item.id, item.destinationId, ...item.stops.flatMap(stop => [stop.id, stop.placeId])]),
  ]
  assert.ok(ids.length > 20)
  assert.ok(ids.every(id => typeof id === 'string' && id.length > 0))
})

test('户外路线停靠点属于同一目的地', () => {
  for (const route of mockDatabase.routes.filter(item => item.sceneType === 'outdoor')) {
    const placeIds = new Set(mockDatabase.places.filter(item => item.destinationId === route.destinationId).map(item => item.id))
    assert.ok(route.stops.every(stop => placeIds.has(stop.placeId)), route.name)
    assert.equal(route.geometry.length, route.stops.length)
  }
})

test('文化点支持多个导游讲解版本', () => {
  assert.equal(mockDatabase.places.length, 5)
  assert.ok(mockDatabase.places.every(item => item.narrations.length >= 2))
  assert.ok(mockDatabase.places.some(item => item.narrations.length >= 3))
})

test('室内和户外路线共享模型但数据隔离', () => {
  const indoorDestination = mockDatabase.destinations.find(item => item.sceneType === 'indoor')
  const outdoorDestination = mockDatabase.destinations.find(item => item.sceneType === 'outdoor')
  assert.ok(indoorDestination && outdoorDestination)
  assert.ok(mockDatabase.routes.some(item => item.destinationId === indoorDestination.id && item.sceneType === 'indoor'))
  assert.ok(mockDatabase.routes.some(item => item.destinationId === outdoorDestination.id && item.sceneType === 'outdoor'))
})

test('讲解站点字段覆盖 C 端站点讲解所需内容', () => {
  const routeIds = new Set(mockDatabase.routes.map(item => item.id))
  const destinationIds = new Set(mockDatabase.destinations.map(item => item.id))
  const guideIds = new Set(mockDatabase.places.flatMap(place => place.narrations.map(narration => narration.guideId)))
  assert.ok(mockDatabase.stages.length >= 5)
  for (const stage of mockDatabase.stages) {
    assert.ok(routeIds.has(stage.routeId), stage.name)
    assert.ok(destinationIds.has(stage.destinationId), stage.name)
    assert.ok(guideIds.has(stage.guideId), stage.name)
    assert.ok(stage.name.trim().length > 0)
    assert.ok(stage.guideName.trim().length > 0, stage.name)
    // 每个站点只维护一段解说词：一段文稿对应一条音频
    assert.equal(stage.segments.length, 1, stage.name)
    assert.ok(stage.segments.every(segment => segment.text.trim().length > 0), stage.name)
    // 音频状态、逐段时长与音频地址必须自洽，避免 C 端拿到半成品数据。
    if (stage.audioStatus === 'ready') assert.ok(stage.audioDurationSeconds > 0, stage.name)
    else assert.equal(stage.audioDurationSeconds, 0, stage.name)
    assert.ok(stage.segments.every(segment => segment.durationSeconds === 0 || segment.audioUrl), stage.name)
  }
})

test('站点配图与多音字可驱动节点编辑窗口', () => {
  const stages = mockDatabase.stages
  const images = stages.flatMap(stage => stage.images)
  const pronunciations = stages.flatMap(stage => stage.pronunciations)
  const ids = stages.flatMap(stage => [stage.id, ...stage.segments.map(item => item.id), ...stage.images.map(item => item.id), ...stage.pronunciations.map(item => item.id)])
  assert.ok(ids.every(id => typeof id === 'string' && id.length > 0))
  assert.ok(stages.every(stage => stage.segments.length === 1))
  assert.ok(stages.some(stage => stage.audioStatus === 'ready'))
  assert.ok(stages.some(stage => stage.audioStatus === 'none'))
  assert.ok(images.length >= 5)
  assert.ok(images.every(image => image.url.startsWith('data:image/') && image.caption.trim().length > 0))
  assert.ok(pronunciations.length >= 6)
  assert.ok(pronunciations.every(item => item.phrase.trim().length > 0 && item.pronunciation.trim().length > 0))
})

test('户外路线站点内容与停靠点一一对应', () => {
  const outdoorRoutes = mockDatabase.routes.filter(item => item.sceneType === 'outdoor')
  assert.ok(outdoorRoutes.length >= 3)
  for (const route of outdoorRoutes) {
    const routeStages = mockDatabase.stages.filter(stage => stage.routeId === route.id)
    assert.equal(routeStages.length, route.stops.length, route.name)
    routeStages.forEach((stage, index) => {
      assert.equal(stage.placeId, route.stops[index]!.placeId, stage.name)
      assert.equal(stage.order, index + 1, stage.name)
      assert.equal(stage.segments.length, 1, stage.name)
    })
  }
  // 同一条路线的相邻站点不会重复引用同一文化点
  for (const route of outdoorRoutes) {
    const placeIds = mockDatabase.stages.filter(stage => stage.routeId === route.id).map(stage => stage.placeId)
    assert.equal(new Set(placeIds).size, placeIds.length, route.name)
  }
})

test('馆藏内容支持新增与编辑（列表数据完整）', () => {
  const collections = mockDatabase.collections
  assert.ok(collections.length >= 4)
  const ids = collections.map(item => item.id)
  assert.equal(new Set(ids).size, ids.length, '馆藏 id 唯一')
  const destinationIds = new Set(mockDatabase.destinations.map(item => item.id))
  for (const item of collections) {
    assert.ok(destinationIds.has(item.destinationId), item.name)
    assert.ok(item.name.trim().length > 0)
    assert.ok(item.code.trim().length > 0, item.name)
    assert.ok(['relic', 'place'].includes(item.kind), item.name)
    assert.ok(['draft', 'pending', 'published'].includes(item.status), item.name)
    assert.ok(item.guideVersions >= 1, item.name)
    assert.ok(item.recommendedMinutes > 0, item.name)
    assert.ok(item.imageUrl === null || item.imageUrl.startsWith('data:image/'), item.name)
  }
  assert.ok(collections.some(item => item.kind === 'relic') && collections.some(item => item.kind === 'place'))
})

test('室内文物站点不绑定文化点，仍按路线维护内容', () => {  const indoorRouteIds = new Set(mockDatabase.routes.filter(item => item.sceneType === 'indoor').map(item => item.id))
  const indoorStages = mockDatabase.stages.filter(stage => indoorRouteIds.has(stage.routeId))
  assert.ok(indoorStages.length >= 5)
  assert.ok(indoorStages.every(stage => stage.placeId === null))
  assert.ok(indoorStages.every(stage => stage.segments.length === 1))
  // 户外站点必须能追溯到文化点，避免出现无法在 C 端定位的讲解内容
  const outdoorStages = mockDatabase.stages.filter(stage => !indoorRouteIds.has(stage.routeId))
  assert.ok(outdoorStages.every(stage => stage.placeId !== null))
  const placeIds = new Set(mockDatabase.places.map(place => place.id))
  assert.ok(outdoorStages.every(stage => placeIds.has(stage.placeId!)), '户外站点需指向有效文化点')
})
