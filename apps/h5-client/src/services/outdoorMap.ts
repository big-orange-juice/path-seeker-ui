import { request } from "@/services/http"
import { fetchOutdoorMapScene as fetchScene } from "@/services/gameplay"
import type { ExhibitChatOutdoorLocation } from "@/types/exhibitChat"
import type { HeritageAssetDetail, OutdoorMapSceneResponse, SiteAreaResponse } from "@path-seeker/ts-shared"

export function fetchOutdoorMapScene(params: Parameters<typeof import("@/services/gameplay").fetchOutdoorMapScene>[0]) {
  return fetchScene(params)
}

export function fetchSiteAreas(museumId: string) {
  return request<{ list?: SiteAreaResponse[] | null }>("/SiteArea/PageList", {
    method: "POST",
    data: { museumId, pageIndex: 1, pageSize: 200 },
  })
}

export function fetchHeritageAsset(assetId: string) {
  return request<HeritageAssetDetail>("/Exhibit/Get", { query: { id: assetId } })
}

export function fetchHeritageAssetLocations(assetId: string) {
  return request<ExhibitChatOutdoorLocation[]>("/ExhibitLocation/List", { query: { exhibitId: assetId } })
}
