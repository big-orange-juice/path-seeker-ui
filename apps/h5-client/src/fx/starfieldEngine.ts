/**
 * 馆夜星空：常态缓慢漂移，过场 / 播片 / loading 时加速。
 * 对齐 h5-demo/js/stars.js
 */

export type StarfieldHandle = {
  setBoost: (mul: number) => void
  swirlTransit: (ms?: number, peak?: number) => Promise<void>
  setPlaying: (on: boolean) => void
  destroy: () => void
}

type Star = {
  x: number
  y: number
  r: number
  base: number
  phase: number
  twSpeed: number
  vx: number
  vy: number
  wobble: number
  wobblePhase: number
  gold: boolean
}

function prefersReducedMotion() {
  if (typeof window === "undefined") {
    return false
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

export function createStarfieldEngine(canvas: HTMLCanvasElement): StarfieldHandle {
  const rawCtx = canvas.getContext("2d")
  if (!rawCtx) {
    return {
      setBoost: () => undefined,
      swirlTransit: async () => undefined,
      setPlaying: () => undefined,
      destroy: () => undefined,
    }
  }
  const ctx: CanvasRenderingContext2D = rawCtx

  let stars: Star[] = []
  let raf = 0
  let w = 0
  let h = 0
  let lastT = 0
  let speedMul = 1
  let targetMul = 1
  const reduced = prefersReducedMotion()

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    w = window.innerWidth
    h = window.innerHeight
    canvas.width = Math.floor(w * dpr)
    canvas.height = Math.floor(h * dpr)
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const count = Math.floor((w * h) / 6800)
    stars = Array.from({ length: Math.max(60, Math.min(170, count)) }, () => {
      const ang = Math.random() * Math.PI * 2
      const baseSpeed = 2.5 + Math.random() * 8
      return {
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.45 + 0.2,
        base: Math.random() * 0.4 + 0.2,
        phase: Math.random() * Math.PI * 2,
        twSpeed: 0.4 + Math.random() * 1.4,
        vx: Math.cos(ang) * baseSpeed,
        vy: Math.sin(ang) * baseSpeed,
        wobble: Math.random() * 0.8 + 0.2,
        wobblePhase: Math.random() * Math.PI * 2,
        gold: Math.random() > 0.82,
      }
    })
  }

  function wrap(v: number, max: number) {
    if (v < -4) return max + 4
    if (v > max + 4) return -4
    return v
  }

  function tick(t: number) {
    const dt = lastT ? Math.min(0.05, (t - lastT) / 1000) : 0.016
    lastT = t
    speedMul += (targetMul - speedMul) * Math.min(1, dt * 2.2)

    const time = t * 0.001
    ctx.clearRect(0, 0, w, h)

    for (const s of stars) {
      const wob = Math.sin(time * s.wobble + s.wobblePhase) * 0.35
      s.x += (s.vx + wob) * speedMul * dt
      s.y += (s.vy - wob * 0.6) * speedMul * dt
      s.x = wrap(s.x, w)
      s.y = wrap(s.y, h)

      const tw = s.base + Math.sin(time * s.twSpeed + s.phase) * 0.28
      const a = Math.max(0.07, Math.min(0.95, tw + (speedMul - 1) * 0.04))

      ctx.beginPath()
      ctx.fillStyle = s.gold ? `rgba(232, 201, 138, ${a})` : `rgba(255, 248, 232, ${a})`
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
      ctx.fill()

      if (s.r > 1.15 && a > 0.55) {
        ctx.beginPath()
        ctx.strokeStyle = s.gold ? `rgba(232, 201, 138, ${a * 0.28})` : `rgba(255, 255, 255, ${a * 0.2})`
        ctx.lineWidth = 0.55
        const arm = s.r * 2
        ctx.moveTo(s.x - arm, s.y)
        ctx.lineTo(s.x + arm, s.y)
        ctx.moveTo(s.x, s.y - arm)
        ctx.lineTo(s.x, s.y + arm)
        ctx.stroke()
      }
    }

    raf = requestAnimationFrame(tick)
  }

  function setBoost(mul: number) {
    targetMul = Math.max(1, Math.min(5, mul || 1))
  }

  function swirlTransit(ms = 1100, peak = 3) {
    if (reduced) {
      return Promise.resolve()
    }
    const duration = Math.max(700, ms)
    const prev = targetMul
    setBoost(peak)
    return new Promise<void>((resolve) => {
      window.setTimeout(() => {
        if (targetMul === peak) {
          setBoost(prev > 1 && prev !== peak ? prev : 1)
        }
        resolve()
      }, duration)
    })
  }

  function setPlaying(on: boolean) {
    if (on) {
      setBoost(2.35)
      return
    }
    if (targetMul <= 2.5) {
      setBoost(1)
    }
  }

  function onResize() {
    resize()
  }

  resize()
  window.addEventListener("resize", onResize)

  if (reduced) {
    lastT = 0
    tick(0)
  } else {
    raf = requestAnimationFrame(tick)
  }

  return {
    setBoost,
    swirlTransit,
    setPlaying,
    destroy() {
      cancelAnimationFrame(raf)
      window.removeEventListener("resize", onResize)
    },
  }
}

let activeHandle: StarfieldHandle | null = null

export function registerStarfield(handle: StarfieldHandle | null) {
  activeHandle = handle
}

export function getStarfield() {
  return activeHandle
}
