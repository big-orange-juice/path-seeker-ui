import { contentLocales } from '../config/locales.ts'
import type { ArtifactStage, Locale, TourRoute } from '../types'

export function localeLabelOf(locale: Locale): string {
  return contentLocales.find(item => item.id === locale)?.label ?? locale
}

export function localeShortOf(locale: Locale): string {
  return contentLocales.find(item => item.id === locale)?.short ?? locale
}

/** 中文路线 id 即线路基准 id；其它语言 id 形如 `<baseId>-en`。 */
export function routeBaseId(route: TourRoute): string {
  return route.id.replace(/-[a-z]{2}$/, '')
}

/** 同一条线路的全部语言版本（含自身），按语言顺序排列。 */
export function siblingRoutes(route: TourRoute, routes: TourRoute[]): TourRoute[] {
  const base = routeBaseId(route)
  return routes
    .filter(item => routeBaseId(item) === base)
    .sort((left, right) => contentLocales.findIndex(item => item.id === left.locale) - contentLocales.findIndex(item => item.id === right.locale))
}

/** 该线路是否已经存在中文源版本。 */
export function hasSourceVersion(route: TourRoute, routes: TourRoute[]): boolean {
  return siblingRoutes(route, routes).some(item => item.locale === 'zh')
}

/** 中文路线生成 TTS 音频，其它语言在 C 端使用系统语音朗读。 */
export function usesSystemSpeech(stage: ArtifactStage): boolean {
  return stage.locale !== 'zh'
}

/** 某个文化点在哪些语言下已维护站点内容。 */
export function placeLocales(placeId: string, stages: ArtifactStage[]): Locale[] {
  return contentLocales
    .filter(item => stages.some(stage => stage.placeId === placeId && stage.locale === item.id))
    .map(item => item.id)
}

/** 列表里的语言标记：哪些语言已有版本、当前行是什么语言。 */
export function routeLocaleSummary(route: TourRoute, routes: TourRoute[]): { id: Locale; label: string; short: string; available: boolean; active: boolean }[] {
  const versions = siblingRoutes(route, routes)
  return contentLocales.map(item => ({
    id: item.id,
    label: item.label,
    short: item.short,
    available: versions.some(version => version.locale === item.id),
    active: route.locale === item.id,
  }))
}
