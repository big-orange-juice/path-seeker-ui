import { computed, ref } from "vue"
import { acceptHMRUpdate, defineStore } from "pinia"
import { getStarfield } from "@/fx/starfieldEngine"

export type CinemaEffect = "fade" | "cinema" | "win" | "swirl"

/**
 * Cinema 过场曾用于路由切换 + 接口 loading 的压暗/升起。
 * 产品要求去掉页面跳转过渡后：视觉层全部 no-op，仅保留 setVideoPlaying 等副作用钩子，
 * 以及 withLoading 的 Promise 包装（不再 dim / swirl / 最短等待）。
 */
export const useCinemaStore = defineStore("cinema", () => {
  const loadingDepth = ref(0)
  const transitBusy = ref(false)
  const viewDimmed = ref(false)
  const viewRising = ref(false)
  const bodySwirl = ref(false)
  const effect = ref<CinemaEffect | null>(null)
  const label = ref("")

  const isActive = computed(() => false)
  const showVeil = computed(() => false)

  function beginLoading(_opts?: { label?: string; effect?: CinemaEffect; peak?: number }) {
    loadingDepth.value += 1
  }

  async function endLoading() {
    if (loadingDepth.value <= 0) {
      return
    }
    loadingDepth.value -= 1
  }

  async function withLoading<T>(
    task: () => Promise<T>,
    _opts?: { label?: string; effect?: CinemaEffect },
  ): Promise<T> {
    beginLoading()
    try {
      return await task()
    } finally {
      await endLoading()
    }
  }

  /** 路由过场已关闭 */
  async function playRouteExit(_opts?: {
    effect?: CinemaEffect
    duration?: number
    label?: string
  }) {
    /* no-op：去掉页面跳转过渡 */
  }

  async function playRouteEnter(_opts?: { duration?: number }) {
    /* no-op */
  }

  async function runTransit(_opts?: {
    effect?: CinemaEffect
    duration?: number
    label?: string
  }) {
    /* no-op */
  }

  function setVideoPlaying(on: boolean) {
    getStarfield()?.setPlaying(on)
  }

  return {
    loadingDepth,
    transitBusy,
    viewDimmed,
    viewRising,
    bodySwirl,
    effect,
    label,
    isActive,
    showVeil,
    beginLoading,
    endLoading,
    withLoading,
    playRouteExit,
    playRouteEnter,
    runTransit,
    setVideoPlaying,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useCinemaStore, import.meta.hot))
}
