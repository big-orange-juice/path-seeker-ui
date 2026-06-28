export const MINI_ROUTES = {
  shell: "/pages/shell/index",
  taskDetail: "/pages/task-detail/index",
  prologue: "/pages/prologue/index",
  chapterMap: "/pages/chapter-map/index",
  artifactClue: "/pages/artifact-clue/index",
  puzzle: "/pages/puzzle/index",
  chapterResult: "/pages/chapter-result/index",
  finale: "/pages/finale/index",
} as const

export function withQuery(path: string, query: Record<string, string | number | undefined>) {
  const search = Object.entries(query)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
    .join("&")

  return search ? `${path}?${search}` : path
}
