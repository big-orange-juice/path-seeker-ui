import assert from 'node:assert/strict'
import test from 'node:test'
import { mockDatabase } from '../src/data/mock.ts'
import { siblingRoutes } from '../src/domain/content.ts'
import { buildLanguageVersion, buildRouteFromPlan, parseStopCount, planRouteFromPrompt, reusableStageCount } from '../src/domain/routeChat.ts'

const request = {
  destinations: mockDatabase.destinations,
  places: mockDatabase.places,
  collections: mockDatabase.collections,
  indoorSpaces: mockDatabase.indoorSpaces,
  routes: mockDatabase.routes,
}

test('对话里的站点数量支持区间与单值两种写法', () => {
  assert.equal(parseStopCount('帮我创建一条关于宋代瓷器的讲解路线，覆盖 6 到 8 个站点。'), 8)
  assert.equal(parseStopCount('围绕馆内青铜器做一条 3 站讲解线'), 3)
  assert.equal(parseStopCount('以后海的胡同为线索做一条半日路线'), null)
})

test('户外提示词命中目的地与关联文物', () => {
  const plan = planRouteFromPrompt('以后海的胡同与王府为线索，做一条半日漫游线', request)
  const destination = mockDatabase.destinations.find(item => item.id === plan.destinationId)
  assert.equal(destination?.name, '北京·后海')
  assert.equal(plan.sceneType, 'outdoor')
  // 未指定站点数量时使用目的地全部文化点；演示数据里后海有 5 个。
  assert.equal(plan.stops.length, 5)
  assert.equal(plan.requestedStops, null)
  assert.equal(plan.fallback, false)
  assert.ok(plan.name.includes('胡同'), plan.name)
  assert.ok(plan.related.length >= 1)
  assert.ok(plan.related.every(item => item.category.length > 0))

  const placeIds = new Set(mockDatabase.places.filter(item => item.destinationId === plan.destinationId).map(item => item.id))
  assert.ok(plan.stops.every(stop => placeIds.has(stop.placeId)))
  assert.ok(plan.stops.every(stop => stop.coordinate !== null))
  assert.equal(parseStopCount('覆盖 6 到 8 个站点'), 8)
})

test('室内提示词收敛到展厅数量，并按内容表补齐站点', () => {
  const plan = planRouteFromPrompt('围绕馆内青铜器做一条 3 站讲解线', request)
  const destination = mockDatabase.destinations.find(item => item.id === plan.destinationId)
  assert.equal(destination?.name, '文化探索馆')
  assert.equal(plan.sceneType, 'indoor')
  assert.equal(plan.requestedStops, 3)
  // 演示数据里文化探索馆只有两个展厅，因此按现有内容收敛为 2 站。
  assert.equal(plan.stops.length, 2)
  assert.ok(plan.stops.some(stop => stop.name === '青铜剑' && stop.imageUrl))
  assert.ok(plan.code.startsWith('MG-R-'))
})

test('提示词未命中演示数据时沿用目的地现有内容搭骨架', () => {
  const plan = planRouteFromPrompt('帮我创建一条关于宋代瓷器的讲解路线，覆盖 6 到 8 个站点。', request)
  assert.equal(plan.fallback, true)
  assert.equal(plan.requestedStops, 8)
  assert.equal(plan.stops.length, 5)
  assert.ok(plan.related.length >= 1)
})

test('规划结果可落成演示数据里的路线与站点契约', () => {
  const plan = planRouteFromPrompt('以后海的胡同与王府为线索，做一条半日漫游线', request)
  const { route, stages } = buildRouteFromPlan(plan, '系统管理员', new Date('2026-09-25T10:20:00'))

  assert.equal(typeof route.id, 'string')
  assert.ok(route.id.length > 0)
  assert.equal(route.status, 'draft')
  assert.equal(route.locale, 'zh')
  assert.equal(route.ownerName, '系统管理员')
  assert.equal(route.geometry.length, route.stops.length)
  assert.equal(stages.length, route.stops.length)
  assert.ok(stages.every((stage, index) => stage.routeId === route.id && stage.placeId === route.stops[index].placeId))
  assert.ok(stages.every(stage => stage.locale === 'zh' && stage.audioStatus === 'ready' && stage.segments[0]?.audioUrl === 'demo:'))
  assert.ok(stages.every(stage => stage.updatedAt === '2026-09-25 10:20'))

  const indoorPlan = planRouteFromPrompt('围绕馆内青铜器做一条 3 站讲解线', request)
  const indoor = buildRouteFromPlan(indoorPlan, '系统管理员', new Date('2026-09-25T10:20:00'))
  assert.equal(indoor.route.geometry.length, 0)
  assert.equal(indoor.route.stops.length, indoor.stages.length)
  assert.ok(indoor.stages.every((stage, index) => stage.placeId === indoor.route.stops[index].placeId))
})

test('多语言转换以中文源为基准生成目标语言版本', () => {
  const plan = planRouteFromPrompt('以后海的胡同与王府为线索，做一条半日漫游线', request)
  const source = buildRouteFromPlan(plan, '系统管理员', new Date('2026-09-25T10:20:00'))
  const destination = mockDatabase.destinations.find(item => item.id === plan.destinationId) ?? null
  const english = buildLanguageVersion(source, 'en', '系统管理员', {
    destination,
    library: mockDatabase.stages,
    now: new Date('2026-09-25T10:30:00'),
  })

  assert.equal(english.route.id, `${source.route.id}-en`)
  assert.equal(english.route.code, `${source.route.code}-EN`)
  assert.equal(english.route.locale, 'en')
  assert.equal(english.route.status, 'draft')
  assert.equal(english.route.stops.length, source.route.stops.length)
  assert.equal(english.route.geometry.length, source.route.geometry.length)
  assert.equal(english.stages.length, source.stages.length)
  // 站点指向中文源站点，便于对照补译文
  assert.ok(english.stages.every((stage, index) => stage.translationOf === source.stages[index].id))
  // 非中文路线由 C 端系统语音朗读，不产出 TTS 音频
  assert.ok(english.stages.every(stage => stage.locale === 'en' && stage.audioStatus === 'none'))
  assert.ok(english.stages.every(stage => stage.segments.every(segment => segment.audioUrl === null && segment.durationSeconds === 0)))
  // 演示数据里已维护的英文译文直接复用，名称与主题也换成英文
  const yandai = english.stages.find(stage => stage.placeId === '290000000000000002')
  assert.equal(yandai?.name, 'Yandai Xiejie')
  assert.equal(yandai?.category, 'Historic lane')
  assert.equal(reusableStageCount(source.stages, mockDatabase.stages, 'en'), source.stages.length)
  assert.ok(english.route.name.startsWith('Houhai · '), english.route.name)
  // 主题取复用译文的类别，因此不再出现中文类别名
  assert.ok(english.route.theme.includes('Historic'), english.route.theme)
  assert.ok(!english.route.theme.includes('故居'), english.route.theme)

  // 中文源与语言版本能被同一线路聚合，列表可直接展示「中文源 → 语言版本」关系
  const routes = [source.route, english.route]
  assert.deepEqual(siblingRoutes(english.route, routes).map(item => item.locale), ['zh', 'en'])
})

test('缺少现成译文的站点标记为译文待补', () => {
  const plan = planRouteFromPrompt('围绕馆内青铜器做一条 3 站讲解线', request)
  const source = buildRouteFromPlan(plan, '系统管理员', new Date('2026-09-25T10:20:00'))
  const spanish = buildLanguageVersion(source, 'es', '系统管理员', { library: mockDatabase.stages })
  // 室内站点不绑定文化点，没有可复用的译文，正文保留中文原文作对照
  assert.ok(spanish.stages.every(stage => reusableStageCount([stage], mockDatabase.stages, 'es') === 0))
  assert.ok(spanish.stages.every(stage => (stage.segments[0]?.text ?? '').startsWith('Traducción pendiente')))
  assert.equal(reusableStageCount(source.stages, mockDatabase.stages, 'es'), 0)
})
