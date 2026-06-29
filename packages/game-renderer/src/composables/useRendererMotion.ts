import { nextTick, onMounted, onUnmounted, ref } from "vue"
import { gsap } from "gsap"

const SUPPORTS_DOM = typeof window !== "undefined" && typeof document !== "undefined"

export function useRendererMotion(enter?: () => void) {
  const root = ref<HTMLElement | null>(null)
  let ctx: gsap.Context | null = null

  async function runEnter() {
    if (!SUPPORTS_DOM || !root.value || !enter) {
      return
    }

    await nextTick()
    ctx?.revert()
    ctx = gsap.context(() => {
      enter()
    }, root.value)
  }

  function animateSelector(
    selector: string,
    fromVars: gsap.TweenVars,
    toVars: gsap.TweenVars,
  ) {
    if (!SUPPORTS_DOM || !root.value) {
      return
    }

    const nodes = root.value.querySelectorAll(selector)

    if (!nodes.length) {
      return
    }

    gsap.killTweensOf(nodes)
    gsap.fromTo(nodes, fromVars, toVars)
  }

  function animateElement(
    target: gsap.TweenTarget,
    fromVars: gsap.TweenVars,
    toVars: gsap.TweenVars,
  ) {
    if (!SUPPORTS_DOM) {
      return
    }

    gsap.killTweensOf(target)
    gsap.fromTo(target, fromVars, toVars)
  }

  onMounted(() => {
    void runEnter()
  })

  onUnmounted(() => {
    ctx?.revert()
  })

  return {
    root,
    runEnter,
    animateSelector,
    animateElement,
    supportsMotion: SUPPORTS_DOM,
  }
}
