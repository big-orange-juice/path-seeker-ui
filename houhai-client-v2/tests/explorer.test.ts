import assert from 'node:assert/strict'
import test from 'node:test'
import { catalog, places, routes } from '../src/data/catalog.ts'
import { completeStop, preferredRoute, restoreProgress, routesForPlace } from '../src/domain/explorer.ts'
import { wgs84ToGcj02 } from '../src/domain/coordinates.ts'
import { mapViewportInsets } from '../src/domain/mapViewport.ts'
import { closestSheetSnap, sheetHeights } from '../src/domain/mapSheet.ts'

test('every cultural place is covered by a valid same-scene preset route', () => {
  assert.equal(places.filter(place => place.scene === 'rickshaw').length, 5)
  for (const place of places) {
    assert.equal(typeof place.id, 'string')
    assert.ok(BigInt(place.id) > BigInt(Number.MAX_SAFE_INTEGER))
    assert.ok(place.narration.every(chapter => chapter.text.length > 50))
    const related = routesForPlace(routes, place.id)
    assert.ok(related.length > 0)
    assert.ok(related.every(route => route.scene === place.scene))
  }
  for (const route of routes) {
    assert.equal(new Set(route.stopIds).size, route.stopIds.length)
    assert.ok(route.stopIds.every(id => places.some(place => place.id === id)))
    if (route.scene === 'rickshaw') {
      assert.ok(route.geometry.length > route.stopIds.length)
      for (const stopId of route.stopIds) {
        const coordinate = places.find(place => place.id === stopId)!.coordinate!
        assert.ok(route.geometry.some(point => point[0] === coordinate[0] && point[1] === coordinate[1]))
      }
    }
  }
})

test('the catalog keeps outdoor towns and venues in separate extensible destination groups', () => {
  assert.deepEqual(catalog.destinations.filter(destination => destination.scene === 'rickshaw').map(destination => destination.id), ['beijing-houhai', 'shanghai-zhujiajiao'])
  assert.deepEqual(catalog.destinations.filter(destination => destination.scene === 'museum').map(destination => destination.id), ['culture-explorer', 'palace-museum', 'shanghai-museum'])
  assert.ok(catalog.destinations.filter(destination => destination.status === 'comingSoon').every(destination => !catalog.places.some(place => place.destinationId === destination.id)))
  assert.ok(catalog.routes.every(route => catalog.destinations.some(destination => destination.id === route.destinationId && destination.scene === route.scene)))
})

test('place selection preserves a relevant preset and replaces an unrelated one', () => {
  assert.equal(preferredRoute(routes, places[2].id, routes[1].id)?.id, routes[1].id)
  assert.equal(preferredRoute(routes, places[1].id, routes[1].id)?.id, routes[0].id)
  assert.equal(preferredRoute(routes, places[5].id, routes[0].id)?.scene, 'museum')
  assert.equal(preferredRoute(routes, 'unknown', routes[0].id), undefined)
})

test('journeys reject skipping, duplicates and another route, and finish in order', () => {
  const route = routes[0]
  let journey = { routeId: route.id, completedStopIds: [] as string[], startedAt: new Date().toISOString() }
  assert.equal(completeStop(journey, route, route.stopIds[1]), journey)
  assert.equal(completeStop(journey, routes[1], route.stopIds[0]), journey)
  for (const stopId of route.stopIds) {
    journey = completeStop(journey, route, stopId)
    assert.equal(completeStop(journey, route, stopId), journey)
  }
  assert.deepEqual(journey.completedStopIds, route.stopIds)
})

test('restoring untrusted browser storage preserves string IDs and sanitizes progress', () => {
  assert.deepEqual(restoreProgress('{broken', catalog), { favorites: [], journeys: [] })
  const restored = restoreProgress(JSON.stringify({ favorites: [places[0].id, places[0].id, 'missing', 2095], journeys: [{ routeId: routes[0].id, completedStopIds: [places[0].id, places[2].id, 'missing'], startedAt: '2026-09-19T08:00:00Z' }, { routeId: 'unknown', completedStopIds: [] }] }), catalog)
  assert.deepEqual(restored.favorites, [places[0].id])
  assert.deepEqual(restored.journeys[0].completedStopIds, [places[0].id])
  assert.equal(restored.journeys.length, 1)
})

test('map coordinate conversion keeps OSM source intact and applies GCJ only for AMap', () => {
  const original = places[0].coordinate!
  const before = [...original]
  const converted = wgs84ToGcj02(original)
  assert.deepEqual(original, before)
  assert.ok(converted[0] - original[0] > 0.005 && converted[0] - original[0] < 0.007)
  assert.ok(converted[1] - original[1] > 0.001 && converted[1] - original[1] < 0.003)
  assert.deepEqual(wgs84ToGcj02([-0.12, 51.5]), [-0.12, 51.5])
})

test('museum routes belong to their venue and keep independent progress for shared exhibits', () => {
  const venueRoutes = routes.filter(route => route.destinationId === 'culture-explorer')
  assert.equal(venueRoutes.length, 6)
  for (const route of venueRoutes) {
    assert.ok(route.guideName && route.coverArtwork)
    assert.ok(route.stopIds.every(id => places.some(place => place.id === id && place.destinationId === route.destinationId)))
  }
  const [first, second] = venueRoutes
  const firstJourney = { routeId: first.id, completedStopIds: first.stopIds, startedAt: '2026-09-20T08:00:00Z' }
  const secondJourney = { routeId: second.id, completedStopIds: [], startedAt: '2026-09-20T09:00:00Z' }
  const restored = restoreProgress(JSON.stringify({ journeys: [firstJourney, secondJourney] }), catalog)
  assert.deepEqual(restored.journeys, [firstJourney, secondJourney])
  assert.deepEqual(completeStop(secondJourney, second, second.stopIds[0]).completedStopIds, [second.stopIds[0]])
  assert.deepEqual(firstJourney.completedStopIds, first.stopIds)
})

test('outdoor places have distinct guide scripts with stable string identities', () => {
  const outdoorPlaces = places.filter(place => place.scene === 'rickshaw')
  const guideIds: string[] = []
  for (const place of outdoorPlaces) {
    const versions = place.guideNarrations ?? []
    assert.ok(versions.length >= 2)
    assert.deepEqual(versions[0].chapters, place.narration)
    assert.equal(new Set(versions.map(version => version.chapters.map(chapter => chapter.text).join(''))).size, versions.length)
    for (const version of versions) {
      assert.equal(typeof version.id, 'string')
      assert.ok(version.guideName && version.specialty && version.title && version.duration > 0)
      assert.ok(version.chapters.length && version.chapters.every(chapter => chapter.title && chapter.text.length > 50))
      guideIds.push(version.id)
    }
  }
  assert.equal(new Set(guideIds).size, guideIds.length)
  assert.equal(outdoorPlaces.find(place => place.name === '恭王府')?.guideNarrations?.length, 3)
})

test('map viewport reserves room for floating content without consuming the whole map', () => {
  const desktop = mapViewportInsets(1440, 800, 94, 500)
  assert.ok(desktop.left >= 404)
  assert.ok(1440 - desktop.left - desktop.right > 800)
  const collapsed = mapViewportInsets(390, 650, 94, 112)
  const expanded = mapViewportInsets(390, 650, 94, 360)
  assert.ok(collapsed.top >= 94)
  assert.ok(collapsed.bottom >= 112)
  assert.ok(expanded.bottom > collapsed.bottom)
  for (const height of [280, 420, 650]) {
    const insets = mapViewportInsets(320, height, 140, 230)
    assert.ok(height - insets.top - insets.bottom >= 79)
    assert.ok(Object.values(insets).every(value => Number.isFinite(value) && value >= 0))
  }
})

test('bottom sheet settles at predictable stops for slow drags and directional flicks', () => {
  const heights = sheetHeights(640, 390, 94)
  assert.equal(heights.collapsed, 130)
  assert.ok(heights.preview > heights.collapsed && heights.full > heights.preview)
  assert.equal(closestSheetSnap(heights, heights.preview - 10, 'collapsed', 0), 'preview')
  assert.equal(closestSheetSnap(heights, heights.full - 15, 'preview', 0), 'full')
  assert.equal(closestSheetSnap(heights, 160, 'preview', 0), 'collapsed')
  assert.equal(closestSheetSnap(heights, heights.preview + 20, 'preview', 0.7), 'full')
  assert.equal(closestSheetSnap(heights, heights.preview - 20, 'preview', -0.7), 'collapsed')
  assert.equal(closestSheetSnap(heights, heights.full, 'full', 1), 'full')
  assert.equal(closestSheetSnap(heights, 130, 'collapsed', -1), 'collapsed')
  const shortScreen = sheetHeights(280, 320, 94)
  assert.ok(shortScreen.collapsed <= shortScreen.preview && shortScreen.preview <= shortScreen.full)
  assert.ok(shortScreen.full <= 280)
  const desktop = sheetHeights(800, 1440, 94)
  assert.ok(desktop.full <= 800 - 94 - 70)
})
