import assert from 'node:assert/strict'
import test from 'node:test'
import { mockDatabase } from '../src/data/mock.ts'
import { toAmapPosition, wgs84ToGcj02 } from '../src/domain/coordinates.ts'

test('WGS84 站点坐标转换为高德 GCJ02 底图坐标', () => {
  const source = { longitude: 116.3868, latitude: 39.9407 }
  const converted = wgs84ToGcj02(source)
  const offsetMeters = Math.hypot((converted.longitude - source.longitude) * 85000, (converted.latitude - source.latitude) * 111320)
  // 北京地区偏移量约数百米，方向为东偏北；偏移量突变说明算法被改坏。
  assert.ok(converted.longitude > source.longitude)
  assert.ok(converted.latitude > source.latitude)
  assert.ok(offsetMeters > 300 && offsetMeters < 900, `偏移 ${Math.round(offsetMeters)} 米`)
})

test('境外坐标不参与偏移，避免误改海外数据', () => {
  const overseas = { longitude: 2.3522, latitude: 48.8566 }
  assert.deepEqual(wgs84ToGcj02(overseas), overseas)
})

test('地图绘制坐标始终可用，且与业务坐标偏差在底图容差内', () => {
  for (const place of mockDatabase.places) {
    const [longitude, latitude] = toAmapPosition({ longitude: place.longitude, latitude: place.latitude })
    assert.ok(Number.isFinite(longitude) && Number.isFinite(latitude), place.name)
    assert.ok(Math.abs(longitude - place.longitude) < 0.01, place.name)
    assert.ok(Math.abs(latitude - place.latitude) < 0.01, place.name)
  }
})
