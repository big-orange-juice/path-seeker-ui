declare module "gsap" {
  export type TweenTarget = unknown
  export type TweenVars = Record<string, unknown>

  export namespace gsap {
    type TweenTarget = unknown
    type TweenVars = Record<string, unknown>

    namespace core {
      interface Tween {
        kill(): void
      }
    }

    interface Context {
      revert(): void
    }

    interface Timeline {
      from(target: unknown, vars: Record<string, unknown>, position?: string): Timeline
      fromTo(
        target: unknown,
        fromVars: Record<string, unknown>,
        toVars: Record<string, unknown>,
        position?: string,
      ): Timeline
    }
  }

  export const gsap: {
    to(target: unknown, vars: Record<string, unknown>): gsap.core.Tween
    from(target: unknown, vars: Record<string, unknown>): gsap.core.Tween
    fromTo(target: unknown, fromVars: Record<string, unknown>, toVars: Record<string, unknown>): gsap.core.Tween
    timeline(config?: Record<string, unknown>): gsap.Timeline
    context(callback: () => void, scope?: unknown): gsap.Context
    killTweensOf(target: unknown): void
  }
}
