import type { DifficultyLevel, MissionRouteCard } from "@/types/mission"

export type MissionCoverTheme = "bronze" | "silk" | "jade"

/** 卡片/详情封面主题：按难度取色，无则按标题哈希 */
export function resolveMissionCoverTheme(
  mission: Pick<MissionRouteCard, "title" | "difficultyLevel" | "theme">,
): MissionCoverTheme {
  if (mission.difficultyLevel === "L1") {
    return "jade"
  }
  if (mission.difficultyLevel === "L3") {
    return "bronze"
  }
  if (mission.difficultyLevel === "L2") {
    return "silk"
  }

  const seed = `${mission.theme || ""}${mission.title || ""}`
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash + seed.charCodeAt(i) * (i + 1)) % 3
  }
  return (["bronze", "silk", "jade"] as const)[hash]
}

export function resolveDifficultyTheme(level?: DifficultyLevel | null): MissionCoverTheme {
  if (level === "L1") return "jade"
  if (level === "L3") return "bronze"
  return "silk"
}
