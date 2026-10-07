import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_APPROACH_POLICY, evaluateApproach, type PlaceRange } from '../../../packages/ts-shared/src/geo-range.ts'

test('景点未配置阈值时保留站点覆盖，显式阈值优先且退出阈值不小于进入阈值', () => {
  const range: PlaceRange = { type: 'circle', radiusMeters: 10, rangeVersion: 1,
    proximityDistanceMeters: null, releaseDistanceMeters: null }
  const fix = { longitude: 0.0009, latitude: 0 }
  const anchor = { longitude: 0, latitude: 0 }
  const stationPolicy = { ...DEFAULT_APPROACH_POLICY, proximityMeters: 150, releaseMeters: 150 }
  const inherited = evaluateApproach(fix, range, anchor, stationPolicy)
  assert.equal(inherited.approaching, true)
  assert.equal(inherited.proximityMeters, 150)
  const explicit = evaluateApproach(fix, { ...range, proximityDistanceMeters: 30, releaseDistanceMeters: 20 }, anchor, stationPolicy)
  assert.equal(explicit.approaching, false)
  assert.equal(explicit.releaseMeters, 30)
})
