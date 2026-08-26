import { computed, shallowRef } from "vue"
import { defineStore } from "pinia"
import { fetchOutdoorMapScene } from "@/services/gameplay"
import type { OutdoorMapSceneResponse } from "@path-seeker/ts-shared"

export const useOutdoorMapStore = defineStore("outdoor-map", () => {
  const scene = shallowRef<OutdoorMapSceneResponse | null>(null)
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

  return { scene, pending, error, assets, selectedAssetType, selectedSiteAreaId, load }
})
