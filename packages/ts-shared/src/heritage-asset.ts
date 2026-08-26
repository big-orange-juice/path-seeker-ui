import type { GeoLocation } from "./geo"

export const HERITAGE_ASSET_TYPE = {
  artifact: 1,
  historicBuilding: 2,
  shop: 3,
  landscape: 4,
  structure: 5,
  street: 6,
  exhibitionSpace: 7,
  facility: 8,
} as const

export interface HeritageAssetSummary {
  id: string
  museumId: string
  galleryId: string | null
  assetType: number
  name: string
  imageUrl: string | null
  siteAreaId: string | null
  primaryLocation: GeoLocation | null
}

export interface HeritageAssetDetail extends HeritageAssetSummary {
  parentExhibitId: string | null
  publicStatus: number
  exhibitCode: string | null
  dynasty: string | null
  material: string | null
  category: string | null
  description: string | null
  constructionYearText: string | null
  currentFunction: string | null
  protectionLevel: string | null
  addressText: string | null
  locations: GeoLocation[]
  extraList?: Array<Record<string, unknown>> | null
  mediaList?: Array<Record<string, unknown>> | null
  aiArchive?: Record<string, unknown> | null
}

export function resolveHeritageAssetTypeName(assetType: number | null | undefined) {
  const names: Record<number, string> = {
    1: "实物文物",
    2: "历史建筑",
    3: "店铺商号",
    4: "景观遗产",
    5: "遗产构筑物",
    6: "街巷空间",
    7: "展览空间",
    8: "服务设施",
  }
  return names[assetType ?? 1] ?? "文化资产"
}
