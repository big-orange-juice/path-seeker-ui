import { onBeforeUnmount, onMounted, shallowRef } from 'vue'

export function useFullscreen() {
  const isFullscreen = shallowRef(false)
  const isSupported = shallowRef(false)

  function syncState() {
    isFullscreen.value = Boolean(document.fullscreenElement)
  }

  async function toggle() {
    if (!isSupported.value) return false
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await document.documentElement.requestFullscreen()
      syncState()
      return true
    } catch {
      syncState()
      return false
    }
  }

  onMounted(() => {
    const root = document.documentElement as HTMLElement & { requestFullscreen?: () => Promise<void> }
    const page = document as Document & { exitFullscreen?: () => Promise<void> }
    isSupported.value = typeof root.requestFullscreen === 'function' && typeof page.exitFullscreen === 'function'
    syncState()
    document.addEventListener('fullscreenchange', syncState)
  })

  onBeforeUnmount(() => {
    document.removeEventListener('fullscreenchange', syncState)
  })

  return { isFullscreen, isSupported, toggle }
}
