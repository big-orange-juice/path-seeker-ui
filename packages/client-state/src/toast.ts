import { computed, shallowRef } from "vue"
import { acceptHMRUpdate, defineStore } from "pinia"

export type ToastTone = "default" | "success" | "warning" | "error"

export interface ToastItem {
  id: string
  title: string
  description?: string
  tone: ToastTone
  durationMs: number
}

export interface ToastPayload {
  title: string
  description?: string
  tone?: ToastTone
  durationMs?: number
}

const DEFAULT_DURATION_MS = 2800

function createToastId() {
  return `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export const useToastStore = defineStore("client-toast", () => {
  const items = shallowRef<ToastItem[]>([])
  const timeoutMap = new Map<string, ReturnType<typeof setTimeout>>()

  const hasItems = computed(() => items.value.length > 0)

  function remove(id: string) {
    const timer = timeoutMap.get(id)
    if (timer) {
      clearTimeout(timer)
      timeoutMap.delete(id)
    }

    items.value = items.value.filter((item) => item.id !== id)
  }

  function push(payload: ToastPayload) {
    const item: ToastItem = {
      id: createToastId(),
      title: payload.title.trim(),
      description: payload.description?.trim(),
      tone: payload.tone || "default",
      durationMs: payload.durationMs ?? DEFAULT_DURATION_MS,
    }

    items.value = [...items.value, item].slice(-4)

    const timer = setTimeout(() => {
      remove(item.id)
    }, item.durationMs)
    timeoutMap.set(item.id, timer)

    return item.id
  }

  function clear() {
    timeoutMap.forEach((timer) => clearTimeout(timer))
    timeoutMap.clear()
    items.value = []
  }

  function success(title: string, description?: string, durationMs?: number) {
    return push({ title, description, tone: "success", durationMs })
  }

  function warning(title: string, description?: string, durationMs?: number) {
    return push({ title, description, tone: "warning", durationMs })
  }

  function error(title: string, description?: string, durationMs?: number) {
    return push({ title, description, tone: "error", durationMs })
  }

  function info(title: string, description?: string, durationMs?: number) {
    return push({ title, description, tone: "default", durationMs })
  }

  return {
    items,
    hasItems,
    push,
    remove,
    clear,
    success,
    warning,
    error,
    info,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useToastStore, import.meta.hot))
}
