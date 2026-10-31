/** 同一景点允许多个站次，节点 ID 按字符串透传。 */
export interface OutdoorTemplatePreview {
  routeId: string
  fixedRouteCode: string
  previewToken: string
  stations: { order: number; placeId: string; placeName: string; title: string; existingStageId: string | null; previousTitle: string | null }[]
  removedStations: { stageId: string; title: string }[]
}
