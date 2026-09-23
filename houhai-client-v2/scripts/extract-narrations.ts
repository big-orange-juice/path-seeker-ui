/**
 * 从 mock 数据中抽取全部讲解词，输出为 JSON。
 * 数据源：
 *   1) src/data/catalog.ts    —— 主目录（路线 → 景点 → 讲解词，含多导游版本）
 *   2) src/ride/catalog.ts    —— 黄包车骑行场景脚本（zh / en / ru / es）
 *
 * 运行：node_modules/.bin/esbuild scripts/extract-narrations.ts --bundle --platform=node --format=esm --outfile=scripts/.tmp-extract.mjs && node scripts/.tmp-extract.mjs
 */
import { writeFileSync } from 'node:fs'
import { catalog } from '../src/data/catalog.ts'
import { buildRideCatalog } from '../src/ride/catalog.ts'

const placeById = new Map(catalog.places.map(place => [place.id, place]))

// ---------- 1. 主目录：路线 → 景点 → 讲解词 ----------
const routes = catalog.routes.map(route => ({
  routeId: route.id,
  routeName: route.title,
  subtitle: route.subtitle,
  scene: route.scene,
  destinationId: route.destinationId,
  tag: route.tag,
  durationMin: route.duration,
  distance: route.distance,
  guideName: route.guideName ?? null,
  transportNote: route.transportNote,
  stops: route.stopIds.flatMap(id => {
    const place = placeById.get(id)
    if (!place) return []
    return [{
      placeId: place.id,
      placeName: place.name,
      placeSubtitle: place.subtitle,
      category: place.category,
      durationMin: place.duration,
      narration: place.narration.map(chapter => ({ title: chapter.title, text: chapter.text })),
      guideNarrations: (place.guideNarrations ?? []).map(version => ({
        versionId: version.id,
        guideName: version.guideName,
        specialty: version.specialty,
        title: version.title,
        durationMin: version.duration,
        chapters: version.chapters.map(chapter => ({ title: chapter.title, text: chapter.text })),
      })),
    }]
  }),
}))

// 景点索引：仅用于反查某景点被哪些路线包含（讲解词见 routes[].stops[]）
const routeIdsByPlace = new Map<string, string[]>()
for (const route of catalog.routes) {
  for (const id of route.stopIds) {
    routeIdsByPlace.set(id, [...(routeIdsByPlace.get(id) ?? []), route.id])
  }
}
const places = catalog.places.map(place => ({
  placeId: place.id,
  placeName: place.name,
  scene: place.scene,
  destinationId: place.destinationId,
  category: place.category,
  artwork: place.artwork,
  intro: place.intro,
  visitNote: place.visitNote,
  routeIds: routeIdsByPlace.get(place.id) ?? [],
}))

// ---------- 2. 黄包车场景：多语言解说脚本 ----------
const locales = ['zh', 'en', 'ru', 'es'] as const
const rideByLocale = locales.map(locale => ({ locale, catalog: buildRideCatalog(locale) }))
const rideBase = rideByLocale[0].catalog
const rideSceneScripts = rideBase.routes.map(baseRoute => {
  const routeNames = Object.fromEntries(
    rideByLocale.map(({ locale, catalog: c }) => [
      locale,
      c.routes.find(route => route.id === baseRoute.id)?.title ?? '',
    ]),
  ) as Record<string, string>
  const stops = baseRoute.stops.map(baseStop => {
    const placeNames = Object.fromEntries(
      rideByLocale.map(({ locale, catalog: c }) => [
        locale,
        c.routes.find(route => route.id === baseRoute.id)?.stops.find(stop => stop.id === baseStop.id)?.name ?? '',
      ]),
    ) as Record<string, string>
    const narration = Object.fromEntries(
      rideByLocale.map(({ locale, catalog: c }) => [
        locale,
        (c.routes.find(route => route.id === baseRoute.id)?.stops.find(stop => stop.id === baseStop.id)?.narration ?? [])
          .map(chapter => chapter.text)
          .join('\n'),
      ]),
    ) as Record<string, string>
    return { placeId: baseStop.id, placeName: placeNames, narration }
  })
  return {
    routeId: baseRoute.id,
    routeName: routeNames,
    guideName: Object.fromEntries(
      rideByLocale.map(({ locale, catalog: c }) => [
        locale,
        c.routes.find(route => route.id === baseRoute.id)?.guideName ?? '',
      ]),
    ) as Record<string, string>,
    stops,
  }
})

const output = {
  generatedAt: new Date().toISOString(),
  source: ['src/data/catalog.ts', 'src/data/guideNarrations.ts', 'src/ride/catalog.ts'],
  routes,
  places,
  rideSceneScripts,
}

const target = new URL('../mock-narrations.json', import.meta.url)
writeFileSync(target, `${JSON.stringify(output, null, 2)}\n`, 'utf8')

// ---------- 3. 拍平列表：[{ routeName, placeName, text }]（每个讲解章节一行）----------
const flat = routes.flatMap(route =>
  route.stops.flatMap(stop =>
    stop.narration.map(chapter => ({
      routeName: route.routeName,
      placeName: stop.placeName,
      text: chapter.text,
    })),
  ),
)

const flatTarget = new URL('../mock-narrations-flat.json', import.meta.url)
writeFileSync(flatTarget, `${JSON.stringify(flat, null, 2)}\n`, 'utf8')
console.log(`flat rows=${flat.length} -> ${flatTarget.pathname}`)

const narrationCount = routes.reduce((sum, route) => sum + route.stops.reduce((s, stop) => s + stop.narration.length, 0), 0)
const guideCount = routes.reduce((sum, route) => sum + route.stops.reduce((s, stop) => s + stop.guideNarrations.length, 0), 0)
console.log(`routes=${routes.length} places=${places.length} 基础讲解章节=${narrationCount} 多导游版本=${guideCount} rideRoutes=${rideSceneScripts.length}`)
console.log(`written: ${target.pathname}`)
