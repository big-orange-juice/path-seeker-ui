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
