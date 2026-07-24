import type { MissionRouteCard } from "@/types/mission"

export type MissionCoverTheme = "bronze" | "silk" | "jade"

/** 封面主题：按标题/主题哈希取色，不依赖难度 */
export function resolveMissionCoverTheme(
  mission: Pick<MissionRouteCard, "title" | "theme">,
): MissionCoverTheme {
  const seed = `${mission.theme || ""}${mission.title || ""}`
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash + seed.charCodeAt(i) * (i + 1)) % 3
  }
  return (["bronze", "silk", "jade"] as const)[hash]
}
