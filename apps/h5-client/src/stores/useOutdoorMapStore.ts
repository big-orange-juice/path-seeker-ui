import { computed, shallowRef } from "vue"
import { defineStore } from "pinia"
import { fetchOutdoorMapScene, fetchOutdoorRouteMap, fetchPublishedRoutes, type RouteCardResponse } from "@/services/gameplay"
import type { OutdoorMapSceneResponse, OutdoorRouteMapResponse } from "@path-seeker/ts-shared"

export const useOutdoorMapStore = defineStore("outdoor-map", () => {
  const scene = shallowRef<OutdoorMapSceneResponse | null>(null)
  const routeMap = shallowRef<OutdoorRouteMapResponse | null>(null)
  const routes = shallowRef<RouteCardResponse[]>([])
  const routesPending = shallowRef(false)
  const routesError = shallowRef<string | null>(null)
  const routePending = shallowRef(false)
  const routeError = shallowRef<string | null>(null)
  const pending = shallowRef(false)
  const error = shallowRef<string | null>(null)
  const selectedAssetType = shallowRef<number | null>(null)
  const selectedSiteAreaId = shallowRef<string | null>(null)
  let requestVersion = 0

  const assets = computed(() => {
    const list = scene.value?.assets ?? []
    return list.filter((asset) =>
      (selectedAssetType.value == null || asset.assetType === selectedAssetType.value)
      && (selectedSiteAreaId.value == null || asset.siteAreaId === selectedSiteAreaId.value),
    )
  })

  async function load(museumId: string) {
    const id = String(museumId || "").trim()
    if (!id) return
    const version = ++requestVersion
    pending.value = true
    error.value = null
    try {
      const next = await fetchOutdoorMapScene({
        museumId: id,
        assetType: selectedAssetType.value ?? undefined,
        siteAreaId: selectedSiteAreaId.value ?? undefined,
      })
      if (version === requestVersion) scene.value = next
    } catch (caught) {
      if (version === requestVersion) error.value = caught instanceof Error ? caught.message : "地图加载失败"
    } finally {
      if (version === requestVersion) pending.value = false
    }
  }

  async function loadRoute(routeId: string) {
    const id = String(routeId || "").trim()
    if (!id) { routeMap.value = null; return }
    routePending.value = true
    routeError.value = null
    try { routeMap.value = await fetchOutdoorRouteMap(id) }
    catch (caught) { routeMap.value = null; routeError.value = caught instanceof Error ? caught.message : "路线地图加载失败" }
    finally { routePending.value = false }
  }

  async function loadRoutes(museumId: string) {
    routesPending.value = true; routesError.value = null
    try {
      const response = await fetchPublishedRoutes({ pageIndex: 1, pageSize: 100, museumId: String(museumId || '').trim() })
      routes.value = response.list ?? []
    } catch (caught) { routesError.value = caught instanceof Error ? caught.message : '路线列表加载失败' }
    finally { routesPending.value = false }
  }

  function clearRoute() { routeMap.value = null; routeError.value = null }

  return { scene, routeMap, routes, pending, routePending, routesPending, error, routeError, routesError, assets, selectedAssetType, selectedSiteAreaId, load, loadRoutes, loadRoute, clearRoute }
})
