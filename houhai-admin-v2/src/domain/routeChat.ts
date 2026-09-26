import { createStageImage } from '../data/mock.ts'
import type { ArtifactStage, CollectionItem, Coordinate, CulturalPlace, Destination, IndoorSpace, Locale, PublishStatus, RouteStop, SceneType, StageAudioStatus, TourRoute } from '../types'
import { estimateAudioSeconds } from '../utils.ts'

/**
 * 对话创建路线的演示实现：正式版由后端 AI 按提示词生成路线与站点，
 * 这里改为按提示词在演示数据中挑选目的地、关联文物与站点，保持同一套结果结构。
 */
export interface RouteChatRequest {
  destinations: Destination[]
  places: CulturalPlace[]
  collections: CollectionItem[]
  indoorSpaces: IndoorSpace[]
  routes: TourRoute[]
}

/** 关联内容：对应正式版「关联文物」，数据来自内容列表的文物与文化点。 */
export interface RouteChatRelated {
  id: string
  name: string
  category: string
  meta: string
}

/** 一个待创建的站点：既是路线停靠点，也是站点内容草稿。 */
export interface RouteChatStopDraft {
  placeId: string
  name: string
  category: string
  summary: string
  arrivalNote: string
  transportMode: RouteStop['transportMode']
  stayMinutes: number
  coordinate: Coordinate | null
  guideId: string
  guideName: string
  guideStyle: string
  segmentTitle: string
  segmentText: string
  imageUrl: string | null
}

export interface RouteChatPlan {
  destinationId: string
  destinationName: string
  sceneType: SceneType
  name: string
  theme: string
  code: string
  /** 提示词里写的站点数量（区间取上限），为空表示未指定。 */
  requestedStops: number | null
  stopCount: number
  distanceKm: number
  estimatedMinutes: number
  stops: RouteChatStopDraft[]
  related: RouteChatRelated[]
  /** 提示词没有命中演示数据，改用目的地现有内容搭骨架。 */
  fallback: boolean
}

/** 两字词里的通用说法不作为匹配依据，避免「创建 / 路线」这类词命中所有内容。 */
const STOP_WORDS = new Set(['帮我', '创建', '一条', '关于', '线路', '路线', '讲解', '覆盖', '个站', '站点', '主题', '希望', '要求', '可以', '需要', '并且', '以及', '包含', '演出', '过程', '内容', '设计'])

const TOPIC_RULES: { pattern: RegExp; topic: string }[] = [
  { pattern: /胡同|街巷|市井/, topic: '胡同' },
  { pattern: /王府|园林|府邸/, topic: '王府' },
  { pattern: /水岸|湖畔|海子|桥梁/, topic: '水岸' },
  { pattern: /名人|故居|近代/, topic: '名人' },
  { pattern: /青铜|兵器|剑/, topic: '青铜' },
  { pattern: /瓷器|瓷|窑/, topic: '瓷器' },
  { pattern: /塔|寺|宗教|佛教/, topic: '宗教' },
  { pattern: /铜镜|生肖|器物|工艺/, topic: '器物' },
]

const DEFAULT_GUIDE = { guideId: 'guide-01', guideName: '顾远', guideStyle: '城市史学者' }

/** 提示词切分为两字片段，作为内容匹配的最小单位。 */
function promptGrams(prompt: string): string[] {
  const grams = new Set<string>()
  const chunks = prompt.toLowerCase().match(/[\u4e00-\u9fa5]+|[a-z0-9]+/g) ?? []
  for (const chunk of chunks) {
    // 纯数字（如「6 到 8 个站点」）只用于站点数量，不参与内容匹配。
    if (/^[a-z0-9]+$/.test(chunk)) {
      if (!/^\d+$/.test(chunk) && chunk.length >= 3) grams.add(chunk)
      continue
    }
    if (chunk.length === 1) continue
    for (let index = 0; index < chunk.length - 1; index += 1) {
      const gram = chunk.slice(index, index + 2)
      if (!STOP_WORDS.has(gram)) grams.add(gram)
    }
  }
  return [...grams]
}

function scoreOf(grams: string[], haystack: string): number {
  return grams.reduce((total, gram) => total + (haystack.includes(gram) ? 1 : 0), 0)
}

function placeHaystack(place: CulturalPlace): string {
  return `${place.name} ${place.category} ${place.description} ${place.address}`
}

function collectionHaystack(item: CollectionItem): string {
  return `${item.name} ${item.category} ${item.era} ${item.material} ${item.description} ${item.location}`
}

/** 「覆盖 6 到 8 个站点」取区间上限，「4 个站点」取单值。 */
export function parseStopCount(prompt: string): number | null {
  const range = prompt.match(/(\d{1,2})\s*(?:[-–—~]|到|至)\s*(\d{1,2})/)
  if (range) return Number(range[2])
  const single = prompt.match(/(\d{1,2})\s*个?\s*(?:站点|节点|站)/)
  return single ? Number(single[1]) : null
}

function distanceBetween(from: Coordinate, to: Coordinate): number {
  const toRadians = (value: number) => value * Math.PI / 180
  const latitudeDelta = toRadians(to.latitude - from.latitude)
  const longitudeDelta = toRadians(to.longitude - from.longitude)
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(toRadians(from.latitude)) * Math.cos(toRadians(to.latitude)) * Math.sin(longitudeDelta / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function round(value: number, digits = 1): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

/**
 * 主题词：优先取提示词里最早出现、且能被选中内容印证的关键词，
 * 提示词提到演示数据里没有的内容时（例如「瓷器」），退回站点自身的类别线索。
 */
function topicOf(prompt: string, haystacks: string[]): string {
  const joined = haystacks.join(' ')
  const promptHits = TOPIC_RULES
    .map((rule, order) => ({ rule, order, index: prompt.match(rule.pattern)?.index ?? -1 }))
    .filter(hit => hit.index >= 0)
    .sort((left, right) => left.index - right.index || left.order - right.order)
  const aligned = promptHits.find(hit => hit.rule.pattern.test(joined))
  if (aligned) return aligned.rule.topic
  return TOPIC_RULES.find(rule => rule.pattern.test(joined))?.topic ?? promptHits[0]?.rule.topic ?? ''
}

/** 新路线编码沿用同目的地的既有前缀，序号顺延。 */
function nextRouteCode(destination: Destination, routes: TourRoute[]): string {
  const peers = routes.filter(route => route.destinationId === destination.id && route.locale === 'zh')
  const prefixes = peers.map(route => route.code.match(/^[A-Z]+/)?.[0]).filter((value): value is string => Boolean(value))
  const prefix = prefixes[0] ?? (destination.sceneType === 'outdoor' ? 'HH' : 'MG')
  const sequence = Math.max(0, ...peers.map(route => Number(route.code.match(/-(\d{1,2})/)?.[1] ?? 0))) + 1
  return `${prefix}-R-${String(sequence).padStart(2, '0')}`
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function planRouteFromPrompt(prompt: string, request: RouteChatRequest): RouteChatPlan {
  const grams = promptGrams(prompt)
  const destinations = request.destinations.map(destination => {
    const places = request.places.filter(item => item.destinationId === destination.id)
    const collections = request.collections.filter(item => item.destinationId === destination.id)
    const itemScore = [...places.map(placeHaystack), ...collections.map(collectionHaystack)]
      .reduce((total, haystack) => total + scoreOf(grams, haystack), 0)
    const named = prompt.includes(destination.name) || scoreOf(grams, `${destination.name} ${destination.intro}`) > 0
    return { destination, itemScore, score: itemScore + (named ? 6 : 0) }
  })
  const picked = destinations.sort((left, right) => right.score - left.score || right.itemScore - left.itemScore)[0]
  const destination = picked.destination

  const sceneType = destination.sceneType
  const places = request.places.filter(item => item.destinationId === destination.id)
  const collections = request.collections.filter(item => item.destinationId === destination.id)
  const galleries = request.indoorSpaces.filter(item => item.destinationId === destination.id && item.kind === 'gallery')

  const relatedSource = collections
    .map(item => ({ item, score: scoreOf(grams, collectionHaystack(item)) }))
    .sort((left, right) => right.score - left.score)
  const matchedRelated = relatedSource.filter(entry => entry.score > 0).map(entry => entry.item)
  const related = (matchedRelated.length ? matchedRelated : collections).slice(0, 4).map(item => ({
    id: item.id, name: item.name, category: item.category,
    meta: [item.category, item.era || item.location].filter(Boolean).join(' · '),
  }))

  const requestedStops = parseStopCount(prompt)
  const available = sceneType === 'outdoor' ? places.length : galleries.length
  const stopCount = available === 0 ? 0 : clamp(requestedStops ?? available, Math.min(2, available), available)

  const rankedPlaces = places
    .map(item => ({ item, score: scoreOf(grams, placeHaystack(item)) }))
    .sort((left, right) => right.score - left.score)
  const rankedGalleries = galleries
    .map(item => ({ item, score: scoreOf(grams, `${item.name} ${item.description}`) }))
    .sort((left, right) => right.score - left.score)

  const guideOf = (place: CulturalPlace | undefined) => {
    const narration = place?.narrations[0]
    return narration
      ? { guideId: narration.guideId, guideName: narration.guideName, guideStyle: narration.guideStyle }
      : DEFAULT_GUIDE
  }

  const stops: RouteChatStopDraft[] = sceneType === 'outdoor'
    ? rankedPlaces.slice(0, stopCount).map((entry, index, list) => {
      const place = entry.item
      const narration = place.narrations[0]
      const previous = index > 0 ? list[index - 1].item : null
      const hopKm = previous ? distanceBetween(previous, place) : 0
      const transportMode: RouteStop['transportMode'] = index === 0 ? 'walk' : hopKm >= 1.2 ? 'rickshaw' : 'walk'
      return {
        placeId: place.id, name: place.name, category: place.category, summary: place.description,
        arrivalNote: index === 0 ? `${place.name}入口集合` : `${place.name}${transportMode === 'rickshaw' ? '落客后进入' : '步行抵达'}`,
        transportMode, stayMinutes: place.recommendedMinutes,
        coordinate: { latitude: place.latitude, longitude: place.longitude },
        ...guideOf(place),
        segmentTitle: narration?.title ?? `${place.name}看点`,
        segmentText: narration?.script ?? place.description,
        // 户外文化点没有独立主图，站点配图沿用占位图生成规则。
        imageUrl: null,
      }
    })
    : rankedGalleries.slice(0, stopCount).map((entry, index) => {
      const gallery = entry.item
      const collection = collections.find(item => item.location.includes(gallery.name)) ?? null
      const name = collection?.name ?? gallery.name
      const summary = collection?.description ?? gallery.description
      const segmentText = collection
        ? `${collection.description} 年代与材质：${collection.era} · ${collection.material}；展陈位置：${collection.location}。`
        : `${gallery.description}（${gallery.name}）`
      return {
        placeId: gallery.id, name, category: collection?.category ?? '展厅',
        summary,
        arrivalNote: index === 0 ? `${gallery.name}入口集合` : `沿一层连廊抵达${gallery.name}`,
        transportMode: 'indoor' as RouteStop['transportMode'], stayMinutes: collection?.recommendedMinutes ?? 25,
        coordinate: null,
        ...guideOf(places[0]),
        segmentTitle: collection ? `${collection.name}看点` : `${gallery.name}讲解`,
        segmentText,
        imageUrl: collection?.imageUrl ?? null,
      }
    })

  const distanceKm = sceneType === 'outdoor'
    ? round(stops.reduce((total, stop, index) => {
      const previous = index > 0 ? stops[index - 1].coordinate : null
      return previous && stop.coordinate ? total + distanceBetween(previous, stop.coordinate) : total
    }, 0) * 1.15)
    : round(stops.length * 0.3)
  const stayMinutes = stops.reduce((total, stop) => total + stop.stayMinutes, 0)
  const estimatedMinutes = Math.round(stayMinutes + (sceneType === 'outdoor' ? distanceKm * 6.2 : 6))

  const categories = [...new Set(stops.map(stop => stop.category))].slice(0, 3)
  const theme = categories.join('、') || '专题'
  const topic = topicOf(prompt, stops.map(stop => `${stop.name} ${stop.category} ${stop.summary}`)) || categories[0] || '专题'
  const shortName = destination.name.replace(/^北京·/, '')

  return {
    destinationId: destination.id, destinationName: destination.name, sceneType,
    name: `${shortName}·${topic}主题线`, theme,
    code: nextRouteCode(destination, request.routes),
    requestedStops, stopCount: stops.length,
    distanceKm, estimatedMinutes, stops, related,
    fallback: matchedRelated.length === 0 && picked.itemScore === 0,
  }
}

function stamp(now: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`
}

/** 一条新建的路线记录及其站点内容。 */
export interface RouteChatResult { route: TourRoute; stages: ArtifactStage[] }

/** 把规划结果落成演示数据里的路线与站点内容（草稿状态，继续走审核上架流程）。 */
export function buildRouteFromPlan(plan: RouteChatPlan, ownerName: string, now = new Date()): RouteChatResult {
  const routeId = `49${String(now.getTime()).slice(-16)}`
  const stops: RouteStop[] = plan.stops.map((stop, index) => ({
    id: `${routeId}-stop-${index + 1}`, placeId: stop.placeId,
    arrivalNote: stop.arrivalNote, transportMode: stop.transportMode, stayMinutes: stop.stayMinutes,
  }))
  const geometry: Coordinate[] = plan.stops
    .map(stop => stop.coordinate)
    .filter((coordinate): coordinate is Coordinate => Boolean(coordinate))

  const route: TourRoute = {
    id: routeId, destinationId: plan.destinationId, code: plan.code, name: plan.name,
    sceneType: plan.sceneType, theme: plan.theme,
    distanceKm: plan.distanceKm, estimatedMinutes: plan.estimatedMinutes,
    status: 'draft', auditRemark: '', ownerName, locale: 'zh',
    stops, geometry,
  }

  const updatedAt = stamp(now)
  const stages: ArtifactStage[] = plan.stops.map((stop, index) => {
    const stageId = `${routeId}-stage-${index + 1}`
    const durationSeconds = estimateAudioSeconds(stop.segmentText)
    return {
      id: stageId, routeId, destinationId: plan.destinationId, order: index + 1,
      name: stop.name, category: stop.category, summary: stop.summary, placeId: stop.placeId, locale: 'zh',
      guideId: stop.guideId, guideName: stop.guideName, guideStyle: stop.guideStyle,
      audioStatus: 'ready', audioDurationSeconds: durationSeconds,
      segments: [{ id: `${stageId}-seg-1`, title: stop.segmentTitle, text: stop.segmentText, audioUrl: 'demo:', durationSeconds }],
      pronunciations: [],
      images: stop.imageUrl
        ? [{ id: `${stageId}-img-1`, url: stop.imageUrl, caption: `${stop.name} · 展陈实拍`, source: 'upload' }]
        : [createStageImage(`${stageId}-img-1`, `${stop.name} · 站点配图`, stop.name.slice(0, 4), (38 + index * 56) % 360, 'ai')],
      videoUrl: null, status: 'draft', updatedAt, translationOf: null,
    }
  })

  return { route, stages }
}

/** 目标语言的演示词表：正式版由翻译能力输出，这里保证 Demo 里的名称与主题也是目标语言。 */
const LOCALE_VOCABULARY: Record<Locale, { destinations: Record<string, string>; topics: Record<string, string>; fallbackTopic: string }> = {
  zh: { destinations: {}, topics: {}, fallbackTopic: '主题线' },
  en: {
    destinations: { '北京·后海': 'Houhai', '文化探索馆': 'Culture Discovery Museum' },
    topics: { 胡同: 'Hutongs', 王府: 'Princely Mansions', 水岸: 'Waterfront', 名人: 'Notable Figures', 青铜: 'Bronzes', 瓷器: 'Porcelain', 宗教: 'Religious Heritage', 器物: 'Objects' },
    fallbackTopic: 'Highlights',
  },
  ru: {
    destinations: { '北京·后海': 'Хоухай', '文化探索馆': 'Музей культуры' },
    topics: { 胡同: 'Хутуны', 王府: 'Княжеские усадьбы', 水岸: 'Набережные', 名人: 'Знаменитые люди', 青铜: 'Бронза', 瓷器: 'Фарфор', 宗教: 'Религиозное наследие', 器物: 'Предметы' },
    fallbackTopic: 'Обзор',
  },
  es: {
    destinations: { '北京·后海': 'Houhai', '文化探索馆': 'Museo de la Cultura' },
    topics: { 胡同: 'Hutongs', 王府: 'Mansiones principescas', 水岸: 'Ribera', 名人: 'Figuras notables', 青铜: 'Bronces', 瓷器: 'Porcelana', 宗教: 'Patrimonio religioso', 器物: 'Objetos' },
    fallbackTopic: 'Recorrido',
  },
}

/** 尚未维护译文的站点：保留中文原文作为对照，并在正文里标注译文待补。 */
const PENDING_PREFIX: Record<Locale, string> = {
  zh: '（译文待补）',
  en: 'Translation pending · Chinese source: ',
  ru: 'Перевод в подготовке · Китайский оригинал: ',
  es: 'Traducción pendiente · Original en chino: ',
}

/** 目标语言路线名称：目的地 + 主题词按词表翻译；词表未覆盖时退回中文原名。 */
function localizedRouteName(source: TourRoute, locale: Locale, destination: Destination | null): string {
  if (locale === 'zh') return source.name
  const vocabulary = LOCALE_VOCABULARY[locale]
  const topic = topicOf(`${source.name} ${source.theme}`, [])
  const localizedTopic = vocabulary.topics[topic] ?? vocabulary.fallbackTopic
  const destinationName = destination ? vocabulary.destinations[destination.name] ?? destination.name : ''
  return destinationName ? `${destinationName} · ${localizedTopic}` : localizedTopic
}

export interface RouteChatVersionOptions {
  /** 关联目的地，用于生成目标语言名称。 */
  destination?: Destination | null
  /** 既有站点内容：按 `placeId + locale` 复用演示数据里已经维护好的译文。 */
  library?: ArtifactStage[]
  now?: Date
}

/** 某条线路已有多少个站点可以直接复用该语言的演示译文。 */
export function reusableStageCount(stages: ArtifactStage[], library: ArtifactStage[], locale: Locale): number {
  return stages.filter(stage => stage.placeId && library.some(item => item.placeId === stage.placeId && item.locale === locale)).length
}

/**
 * 以中文源版本为基准生成目标语言版本：转换方向固定为「中文 → 其它语言」，
 * 复用相同停靠点与文化点，站点内容优先复用同语言的演示译文，否则标记译文待补。
 */
export function buildLanguageVersion(source: RouteChatResult, locale: Locale, ownerName: string, options: RouteChatVersionOptions = {}): RouteChatResult {
  const now = options.now ?? new Date()
  const library = options.library ?? []
  const sourceRoute = source.route
  const routeId = `${sourceRoute.id}-${locale}`
  const updatedAt = stamp(now)

  const stages: ArtifactStage[] = source.stages.map((stage, index) => {
    const reused = stage.placeId ? library.find(item => item.placeId === stage.placeId && item.locale === locale) ?? null : null
    const stageId = `${routeId}-stage-${index + 1}`
    const segments = reused
      ? reused.segments.map((segment, segmentIndex) => ({
        id: `${stageId}-seg-${segmentIndex + 1}`, title: segment.title, text: segment.text, audioUrl: null, durationSeconds: 0,
      }))
      : [{
        id: `${stageId}-seg-1`, title: stage.segments[0]?.title ?? stage.name,
        text: `${PENDING_PREFIX[locale]}${stage.segments[0]?.text ?? stage.summary}`, audioUrl: null, durationSeconds: 0,
      }]
    return {
      id: stageId, routeId, destinationId: stage.destinationId, order: index + 1,
      name: reused?.name ?? stage.name, category: reused?.category ?? stage.category, summary: reused?.summary ?? stage.summary,
      placeId: stage.placeId, locale,
      guideId: reused?.guideId ?? stage.guideId, guideName: reused?.guideName ?? stage.guideName, guideStyle: reused?.guideStyle ?? stage.guideStyle,
      // 非中文路线由 C 端使用系统语音朗读，不再产出 TTS 音频。
      audioStatus: 'none' as StageAudioStatus, audioDurationSeconds: 0,
      segments,
      pronunciations: [],
      images: (reused?.images ?? stage.images).map((image, imageIndex) => ({ ...image, id: `${stageId}-img-${imageIndex + 1}` })),
      videoUrl: null, status: 'draft' as PublishStatus, updatedAt,
      translationOf: stage.id,
    }
  })

  const theme = [...new Set(stages.map(item => item.category))].slice(0, 3).join('、') || sourceRoute.theme
  const route: TourRoute = {
    ...sourceRoute,
    id: routeId,
    code: `${sourceRoute.code}-${locale.toUpperCase()}`,
    name: localizedRouteName(sourceRoute, locale, options.destination ?? null),
    theme,
    locale,
    status: 'draft',
    auditRemark: '',
    ownerName,
    stops: sourceRoute.stops.map((stop, index) => ({ ...stop, id: `${routeId}-stop-${index + 1}` })),
  }

  return { route, stages }
}
