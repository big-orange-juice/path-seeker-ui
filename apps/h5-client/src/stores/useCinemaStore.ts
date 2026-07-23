import { computed, ref } from "vue"
import { acceptHMRUpdate, defineStore } from "pinia"
import { getStarfield } from "@/fx/starfieldEngine"

export type CinemaEffect = "fade" | "cinema" | "win" | "swirl"

function prefersReducedMotion() {
  if (typeof window === "undefined") {
    return false
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

function wait(ms: number) {
  const reduced = prefersReducedMotion()
  const t = reduced ? Math.min(ms, 80) : ms
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, t)
  })
}

/**
 * Cinema 过场 = 路由切换 + 接口 loading 共用同一套「斗转」表现：
 * 星空加速、内容压暗、金雾 veil（无中心光圈）。
 * loading 可嵌套（ref-count），与路由过场叠加时保持 veil 直至全部结束。
 */
export const useCinemaStore = defineStore("cinema", () => {
  const loadingDepth = ref(0)
  const transitBusy = ref(false)
  const viewDimmed = ref(false)
  const viewRising = ref(false)
  const bodySwirl = ref(false)
  const effect = ref<CinemaEffect | null>(null)
  const label = ref("")
  const minLoadingMs = 520
  let loadingStartedAt = 0

  const isActive = computed(() => loadingDepth.value > 0 || transitBusy.value)
  const showVeil = computed(() => isActive.value || viewDimmed.value)

  function syncBodyClass() {
    if (typeof document === "undefined") {
      return
    }
    document.body.classList.toggle("fx-swirl", bodySwirl.value || isActive.value)
  }

  function setSwirl(on: boolean) {
    bodySwirl.value = on
    syncBodyClass()
  }

  /**
   * 接口 loading：同一 cinema 语言。
   * 可嵌套调用，全部 end 后才收 veil。
   */
  function beginLoading(opts?: { label?: string; effect?: CinemaEffect; peak?: number }) {
    loadingDepth.value += 1
    if (loadingDepth.value === 1) {
      loadingStartedAt = Date.now()
      effect.value = opts?.effect || "cinema"
      label.value = opts?.label || "载入中"
      viewDimmed.value = true
      setSwirl(true)
      getStarfield()?.setBoost(opts?.peak ?? 3.0)
    } else if (opts?.label) {
      label.value = opts.label
    }
    syncBodyClass()
  }

  async function endLoading() {
    if (loadingDepth.value <= 0) {
      return
    }

    loadingDepth.value -= 1
    if (loadingDepth.value > 0) {
      return
    }

    const elapsed = Date.now() - loadingStartedAt
    const remain = Math.max(0, minLoadingMs - elapsed)
    if (remain > 0 && !prefersReducedMotion()) {
      await wait(remain)
    }

    if (transitBusy.value) {
      // 路由过场仍在进行，只降星空峰值由 transit 收尾
      label.value = ""
      return
    }

    viewDimmed.value = false
    viewRising.value = true
    label.value = ""
    effect.value = null
    getStarfield()?.setBoost(1)
    setSwirl(false)
    await wait(420)
    viewRising.value = false
    syncBodyClass()
  }

  async function withLoading<T>(
    task: () => Promise<T>,
    opts?: { label?: string; effect?: CinemaEffect },
  ): Promise<T> {
    beginLoading(opts)
    try {
      return await task()
    } finally {
      await endLoading()
    }
  }

  /** 路由离开前：压暗 + 星空斗转（不阻塞过久，与 loading 可叠加） */
  async function playRouteExit(opts?: {
    effect?: CinemaEffect
    duration?: number
    label?: string
  }) {
    if (prefersReducedMotion()) {
      return
    }

    const duration = Math.max(720, opts?.duration ?? 900)
    const nextEffect = opts?.effect || "swirl"
    transitBusy.value = true
    effect.value = nextEffect
    label.value = opts?.label || ""
    viewDimmed.value = true
    viewRising.value = false
    setSwirl(true)

    const peak = nextEffect === "win" ? 3.4 : nextEffect === "cinema" ? 3.2 : 3.0
    void getStarfield()?.swirlTransit(duration, peak)

    await wait(duration * 0.38)
  }

  /** 路由进入后：内容升起，结束过场（若仍有 loading 则保持 veil） */
  async function playRouteEnter(opts?: { duration?: number }) {
    const duration = Math.max(500, opts?.duration ?? 700)

    if (prefersReducedMotion()) {
      transitBusy.value = false
      if (loadingDepth.value === 0) {
        viewDimmed.value = false
        setSwirl(false)
      }
      syncBodyClass()
      return
    }

    // 新页先保持 dim 一帧再 rise
    await wait(30)
    viewDimmed.value = false
    viewRising.value = true

    await wait(duration * 0.55)

    transitBusy.value = false
    if (loadingDepth.value === 0) {
      label.value = ""
      effect.value = null
      setSwirl(false)
      // swirlTransit 会自行回落；若 loading 未占用则确保常态
      if (!getStarfield()) {
        /* no-op */
      }
    }

    await wait(220)
    viewRising.value = false
    syncBodyClass()
  }

  /** 整段过场（编程式导航时使用） */
  async function runTransit(opts?: {
    effect?: CinemaEffect
    duration?: number
    label?: string
  }) {
    await playRouteExit(opts)
    await playRouteEnter({ duration: opts?.duration })
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
