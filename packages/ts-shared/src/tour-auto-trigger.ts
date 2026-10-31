/** 自动到站前序条件仅影响已配置的节点；手动浏览和播放不受此规则限制。 */
export interface AutoTriggerStop {
  id: string
  autoTriggerPrerequisiteStageId?: string | null
}

interface VisitArrivalProgress {
  visitId: string
  visitedStageIds?: string[] | null
  completedStageIds?: string[] | null
}

/** 并行播放进度响应不能撤回已到访记录；新游览必须使用自己的集合。 */
export function mergeVisitArrivalProgress<T extends VisitArrivalProgress>(current: VisitArrivalProgress | null | undefined, incoming: T): T {
  if (!current || !incoming.visitId || current.visitId !== incoming.visitId) return incoming
  return { ...incoming, visitedStageIds: [...new Set([
    ...(current.visitedStageIds ?? []), ...(current.completedStageIds ?? []),
    ...(incoming.visitedStageIds ?? []), ...(incoming.completedStageIds ?? []),
  ])] }
}

export function canAutoTriggerStop(
  stop: AutoTriggerStop,
  stops: readonly AutoTriggerStop[],
  visitedStageIds: Iterable<string> = [],
): boolean {
  const prerequisite = stop.autoTriggerPrerequisiteStageId
  if (!prerequisite) return true
  const index = stops.findIndex(item => item.id === stop.id)
  const before = stops.findIndex(item => item.id === prerequisite)
  // 被删除、错绑其他路线或重排到终点之后的前序不能意外解锁终点。
  if (index !== stops.length - 1 || before < 0 || before >= index) return false
  return new Set(visitedStageIds).has(prerequisite)
}
