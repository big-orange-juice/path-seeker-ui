import assert from 'node:assert/strict'
import test from 'node:test'
import { mockDatabase } from '../src/data/mock.ts'
import { contentLocales } from '../src/config/locales.ts'
import { placeLocales, routeBaseId, routeLocaleSummary, siblingRoutes, usesSystemSpeech } from '../src/domain/content.ts'
import type { Locale } from '../src/types.ts'

const localeIds: Locale[] = contentLocales.map(item => item.id)

test('一条路线一种语言，语言版本是各自独立的路线记录', () => {
  const ids = mockDatabase.routes.map(item => item.id)
  assert.equal(new Set(ids).size, ids.length, '路线 id 唯一')
  const codes = mockDatabase.routes.map(item => item.code)
  assert.equal(new Set(codes).size, codes.length, '路线编码唯一')
  for (const route of mockDatabase.routes) {
    assert.ok(localeIds.includes(route.locale), `${route.name} 语言`)
    assert.ok(route.name.trim().length > 0)
    assert.ok(route.theme.trim().length > 0)
  }
  // 中文版本使用原始 id / 编码，其它语言带语言后缀
  for (const route of mockDatabase.routes) {
    if (route.locale === 'zh') assert.equal(route.id, routeBaseId(route))
    else assert.equal(route.id, `${routeBaseId(route)}-${route.locale}`)
  }
})

test('同一条线路的语言版本可通过基准 id 聚合，且都含中文源版本', () => {
  for (const route of mockDatabase.routes) {
    const versions = siblingRoutes(route, mockDatabase.routes)
    assert.ok(versions.length >= 1)
    assert.equal(versions.filter(item => item.locale === route.locale).length, 1, `${route.name} 同语言版本唯一`)
    assert.ok(versions.some(item => item.locale === 'zh'), `${route.name} 缺少中文源版本`)
    const summary = routeLocaleSummary(route, mockDatabase.routes)
    assert.equal(summary.filter(item => item.available).length, versions.length)
    assert.equal(summary.filter(item => item.active).length, 1)
  }
  const multi = mockDatabase.routes.filter(item => siblingRoutes(item, mockDatabase.routes).length >= 3)
  assert.ok(multi.length >= 1, '至少有一条线路覆盖 3 种以上语言')
})

test('站点语言跟随路线：中文站点有音频，其它语言使用系统语音', () => {
  const routeById = new Map(mockDatabase.routes.map(item => [item.id, item]))
  for (const stage of mockDatabase.stages) {
    const route = routeById.get(stage.routeId)
    assert.ok(route, stage.name)
    assert.equal(stage.locale, route!.locale, `${stage.name} 站点语言与路线一致`)
    assert.ok(localeIds.includes(stage.locale))
    assert.equal(stage.segments.length, 1, stage.name)
    assert.ok(stage.segments.every(segment => segment.text.trim().length > 0), stage.name)
    if (usesSystemSpeech(stage)) {
      assert.equal(stage.audioStatus, 'none', `${stage.name} 非中文不生成音频`)
      assert.equal(stage.audioDurationSeconds, 0)
      assert.ok(stage.segments.every(segment => segment.audioUrl === null), stage.name)
      assert.ok(stage.translationOf, `${stage.name} 需记录对应的中文源站点`)
    } else {
      assert.equal(stage.translationOf, null)
    }
  }
  // 译文站点必须能追溯到同线路中文源站点的 id
  const stageIds = new Set(mockDatabase.stages.map(item => item.id))
  for (const stage of mockDatabase.stages.filter(item => item.translationOf)) {
    assert.ok(stageIds.has(stage.translationOf!), `${stage.name} 的源站点 ${stage.translationOf} 不存在`)
    const source = mockDatabase.stages.find(item => item.id === stage.translationOf)!
    assert.equal(source.locale, 'zh', `${stage.name} 的源站点应为中文`)
    assert.equal(source.order, stage.order, `${stage.name} 与源站点顺序一致`)
    assert.equal(source.placeId, stage.placeId, `${stage.name} 与源站点指向同一文化点`)
  }
})

test('语言筛选与覆盖度数据可用于列表过滤', () => {
  for (const locale of localeIds) {
    const rows = mockDatabase.routes.filter(item => item.locale === locale)
    assert.ok(rows.every(item => item.locale === locale))
  }
  assert.ok(mockDatabase.routes.some(item => item.locale === 'zh'))
  assert.ok(mockDatabase.routes.some(item => item.locale === 'en'))
  assert.ok(mockDatabase.routes.some(item => item.locale === 'ru'))
  assert.ok(mockDatabase.routes.some(item => item.locale === 'es'))
  const place = mockDatabase.places[0]!
  const locales = placeLocales(place.id, mockDatabase.stages)
  assert.ok(locales.length >= 1)
})
