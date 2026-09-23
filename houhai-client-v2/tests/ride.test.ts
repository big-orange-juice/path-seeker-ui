import assert from 'node:assert/strict'
import test from 'node:test'
import { buildRideCatalog } from '../src/ride/catalog.ts'
import { languages, message } from '../src/ride/i18n.ts'
import { advanceAfterStory, arrivalPolicy, distanceMeters, nearbyStop, scannedRoute, transitionJourney, type JourneyPlayback } from '../src/ride/progression.ts'

const initial: JourneyPlayback = { current: 0, furthest: 0, status: 'playing', manualPause: false, finished: false }

test('arrival queues the nearest new story without interrupting the active narration', () => {
  const arrived = transitionJourney(initial, { type: 'arrive', index: 1 })
  assert.equal(arrived.current, 0)
  assert.equal(arrived.status, 'playing')
  assert.equal(arrived.pending, 1)
  assert.equal(transitionJourney(arrived, { type: 'end' }).current, 1)
})

test('passing multiple places replaces queued content instead of building a backlog', () => {
  const first = transitionJourney(initial, { type: 'arrive', index: 1 })
  const latest = transitionJourney(first, { type: 'arrive', index: 3 })
  assert.equal(latest.pending, 3)
  assert.equal(latest.current, 0)
  assert.equal(transitionJourney(latest, { type: 'end' }).current, 3)
  assert.equal(transitionJourney(latest, { type: 'arrive', index: 1 }), latest)
})

test('manual pause blocks autoplay on arrival and resume finishes the interrupted story first', () => {
  const paused = transitionJourney(initial, { type: 'pause' })
  const arrived = transitionJourney(paused, { type: 'arrive', index: 2 })
  assert.equal(arrived.status, 'paused')
  assert.equal(arrived.current, 0)
  const resumed = transitionJourney(arrived, { type: 'resume' })
  assert.equal(resumed.current, 0)
  assert.equal(resumed.manualPause, false)
  assert.equal(transitionJourney(resumed, { type: 'end' }).current, 2)
})

test('idle arrival starts immediately, audio failure blocks automatic retry, manual selection remains available', () => {
  const idle = transitionJourney(initial, { type: 'end' })
  const arrived = transitionJourney(idle, { type: 'arrive', index: 1 })
  assert.equal(arrived.current, 1)
  assert.equal(arrived.status, 'playing')
  const error = transitionJourney(arrived, { type: 'error' })
  const pending = transitionJourney(error, { type: 'arrive', index: 2 })
  assert.equal(pending.current, 1)
  assert.equal(pending.status, 'idle')
  assert.equal(transitionJourney(pending, { type: 'select', index: 2 }).status, 'playing')
})

test('discarding a passed stop prevents stale narration from starting', () => {
  const pending = transitionJourney(initial, { type: 'arrive', index: 1 })
  const cleared = transitionJourney(pending, { type: 'discardPending' })
  const ended = transitionJourney(cleared, { type: 'end' })
  assert.equal(ended.status, 'idle')
  assert.equal(ended.current, 0)
  assert.equal(ended.furthest, 1)
})

test('arrival matching rejects stale, inaccurate and invalid fixes and never moves backwards', () => {
  const stops = buildRideCatalog('zh').routes[0].stops
  const fix = { coordinate: stops[1].coordinate!, accuracy: 12, timestamp: 100000 }
  assert.equal(nearbyStop(stops, fix, 0, 100001), 1)
  assert.equal(nearbyStop(stops, fix, 1, 100001), undefined)
  assert.equal(nearbyStop(stops, { ...fix, accuracy: arrivalPolicy.maxAccuracy + 1 }, 0, 100001), undefined)
  assert.equal(nearbyStop(stops, fix, 0, 120000), undefined)
  assert.equal(nearbyStop(stops, { ...fix, coordinate: [NaN, 30] }, 0, 100001), undefined)
  assert.equal(nearbyStop(stops, { ...fix, coordinate: [0, 0] }, 0, 100001), undefined)
  assert.equal(distanceMeters(fix.coordinate, fix.coordinate), 0)
})

test('four language catalogs retain string identifiers, route identity and localized narration', () => {
  const original = buildRideCatalog('zh')
  for (const language of languages) {
    const translated = buildRideCatalog(language.id)
    assert.deepEqual(translated.routes.map(route => route.id), original.routes.map(route => route.id))
    assert.equal(new Set(translated.routes.map(route => route.guideName)).size, 3)
    for (const route of translated.routes) {
      assert.equal(typeof route.id, 'string')
      assert.ok(BigInt(route.id) > BigInt(Number.MAX_SAFE_INTEGER))
      assert.deepEqual(route.stopIds, route.stops.map(stop => stop.id))
      assert.ok(route.stops.every(stop => stop.narration[0].text.length > 100))
      if (language.id !== 'zh') assert.ok(!/[\u3400-\u9fff]/u.test([route.title, route.specialty, ...route.stops.map(stop => stop.narration[0].text)].join('')))
    }
    assert.ok(message(language.id, 'start'))
  }
})

test('chinese stops carry the remote tts clips while other languages keep system speech', () => {
  const stops = buildRideCatalog('zh').routes.flatMap(route => route.stops)
  const withAudio = stops.filter(stop => stop.narrationAudio?.length)
  assert.ok(withAudio.length >= 10, '多数中文站点带上远程音频')
  for (const stop of withAudio) {
    assert.equal(stop.narration.length, stop.narrationAudio!.length)
    assert.ok(stop.intro.includes(stop.narrationAudio![0].text), `${stop.name} 文稿与音频一致`)
    for (const clip of stop.narrationAudio!) {
      assert.match(clip.audio, /^https:\/\/omaha-wenlv\.oss-cn-beijing\.aliyuncs\.com\//)
      assert.ok(clip.durationMs > 0)
      assert.ok(clip.text.length > 100)
    }
  }
  const palace = stops.find(stop => stop.name === '恭王府')
  assert.equal(palace?.narrationAudio?.length, 2, '恭王府保留两段远程音频')
  for (const language of languages.filter(item => item.id !== 'zh')) {
    const translated = buildRideCatalog(language.id).routes.flatMap(route => route.stops)
    assert.ok(translated.every(stop => !stop.narrationAudio), '非中文不挂中文音频')
  }
})

test('a finished story rolls on to the next stop and stops at the last one', () => {
  const ended = advanceAfterStory(transitionJourney({ ...initial, current: 0, furthest: 0 }, { type: 'end' }), 3)
  assert.equal(ended.current, 1)
  assert.equal(ended.status, 'playing')
  assert.equal(ended.finished, false)
  assert.equal(ended.furthest, 1)
  const last = advanceAfterStory(transitionJourney({ ...initial, current: 2, furthest: 2 }, { type: 'end' }), 3)
  assert.equal(last.current, 2)
  assert.equal(last.finished, true)
  assert.equal(advanceAfterStory(transitionJourney({ ...initial, current: 0 }, { type: 'pause' }), 3).status, 'paused')
  const queued = transitionJourney({ ...initial, current: 0, furthest: 0, pending: 2 }, { type: 'end' })
  assert.equal(advanceAfterStory(queued, 3).current, 2, '到达排队优先于顺序接播')
})

test('scanned route ids preserve all digits and unavailable routes are explicit', () => {
  const ids = buildRideCatalog('zh').routes.map(route => route.id)
  assert.deepEqual(scannedRoute(`?routeId=${ids[2]}&lang=ru`, ids), { id: ids[2], invalid: false })
  assert.deepEqual(scannedRoute('?routeId=2096000000000000999', ids), { id: undefined, invalid: true })
  assert.deepEqual(scannedRoute('', ids), { id: undefined, invalid: false })
})

test('building highlights keep a sane footprint around their own stop', () => {
  const highlighted: string[] = []
  for (const language of languages) {
    for (const route of buildRideCatalog(language.id).routes) {
      for (const stop of route.stops) {
        if (!stop.building) continue
        highlighted.push(stop.name)
        assert.ok(stop.coordinate, `${stop.name} lacks a coordinate`)
        assert.ok(stop.building.height > 0 && stop.building.height <= 40, `${stop.name} height out of range`)
        assert.ok(stop.building.outline.length >= 3, `${stop.name} outline needs a closed shape`)
        for (const point of stop.building.outline) {
          assert.ok(distanceMeters(stop.coordinate, point) <= 400, `${stop.name} outline drifts away from the stop`)
        }
      }
    }
  }
  assert.ok(highlighted.includes('恭王府'), 'the mansion keeps its highlight')
  assert.ok(highlighted.length > 0)
})
