import type { RouteLocationNormalized } from "vue-router"
import type { CinemaEffect } from "@/stores/useCinemaStore"

/** 根据目标路由选择过场气质 */
export function resolveRouteCinemaEffect(
  to: RouteLocationNormalized,
  from: RouteLocationNormalized,
): CinemaEffect {
  const toPath = to.path
  const fromPath = from.path

  if (toPath.includes("/video")) {
    return "cinema"
  }

  if (toPath.includes("/finale") || toPath.includes("/result")) {
    return "win"
  }

  if (toPath.startsWith("/missions") || fromPath.startsWith("/missions")) {
    return "swirl"
  }

  if (toPath.startsWith("/tasks") || toPath.startsWith("/shell")) {
    return "fade"
  }

  return "fade"
}

export function shouldRunRouteCinema(
  to: RouteLocationNormalized,
  from: RouteLocationNormalized,
) {
  if (!from.matched.length) {
    return false
  }
  if (to.path === from.path && to.fullPath === from.fullPath) {
    return false
  }
  // 同页仅 query 变化不播过场
  if (to.name === from.name && to.path === from.path) {
    return false
  }
  return true
}

export function resolveRouteCinemaLabel(to: RouteLocationNormalized): string {
  if (to.path.includes("/brief") || to.path.includes("/clue") || to.path.includes("/video") || to.path.includes("/puzzle")) {
    return "进入本站"
  }
  if (to.path.includes("/map")) return "展开路线"
  if (to.path.includes("/finale")) return "通关结算"
  if (to.path.includes("/result")) return "本站完成"
  return ""
}
