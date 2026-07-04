export const MINI_ROUTES = {
  home: "/pages/index/index",
  missionCenter: "/pages/mission-center/index",
  archive: "/pages/archive/index",
  auth: "/pages/auth/index",
  taskDetail: "/pages/task-detail/index",
  prologue: "/pages/prologue/index",
  chapterMap: "/pages/chapter-map/index",
  artifactClue: "/pages/artifact-clue/index",
  puzzle: "/pages/puzzle/index",
  chapterResult: "/pages/chapter-result/index",
  finale: "/pages/finale/index",
} as const

export const MINI_ROUTE_KEYS = Object.fromEntries(
  Object.entries(MINI_ROUTES).map(([key, value]) => [key, value.replace(/^\//, "")]),
) as Record<keyof typeof MINI_ROUTES, string>

export function isMiniRoute(path: string, route: string) {
  return path === route.replace(/^\//, "")
}

export function isFabTopLevelRoute(path: string) {
  return [MINI_ROUTE_KEYS.home, MINI_ROUTE_KEYS.missionCenter, MINI_ROUTE_KEYS.archive, MINI_ROUTE_KEYS.auth].includes(path)
}

export function withQuery(path: string, query: Record<string, string | number | undefined>) {
  const search = Object.entries(query)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
    .join("&")

  return search ? `${path}?${search}` : path
}
