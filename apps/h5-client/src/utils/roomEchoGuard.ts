const prefix = 'path-seeker:translation-mic:'
const leaseMs = 15000

export function createRoomEchoGuard(onChange: (capturing: boolean) => void) {
  const captures = new Set<symbol>()
  const browser = typeof window === 'undefined' ? null : window
  const key = `${prefix}${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`
  let storage: Storage | null = null
  try { storage = browser?.localStorage ?? null } catch { }
  let active = false
  let disposed = false

  function refresh() {
    let next = captures.size > 0
    try {
      if (storage) {
        for (let index = 0; index < storage.length; index++) {
          const storedKey = storage.key(index)
          if (storedKey?.startsWith(prefix) && Number(storage.getItem(storedKey)) > Date.now()) next = true
        }
      }
    } catch { }
    if (active !== next) { active = next; onChange(active) }
    return active
  }

  function publish() {
    if (!captures.size) return
    try { storage?.setItem(key, String(Date.now() + leaseMs)) } catch { }
  }

  function onPageHide() {
    try { storage?.removeItem(key) } catch { }
  }

  function onPageShow() { publish(); refresh() }

  function release(token: symbol) {
    captures.delete(token)
    if (!captures.size) {
      try { storage?.removeItem(key) } catch { }
    }
    refresh()
  }

  function onStorage(event: StorageEvent) {
    if (event.key === null || event.key.startsWith(prefix)) refresh()
  }

  function dispose() {
    if (disposed) return
    disposed = true
    captures.clear()
    try { storage?.removeItem(key) } catch { }
    if (timer) clearInterval(timer)
    browser?.removeEventListener('storage', onStorage)
    browser?.removeEventListener('pagehide', onPageHide)
    browser?.removeEventListener('pageshow', onPageShow)
  }

  const timer = browser ? setInterval(() => { publish(); refresh() }, 2000) : null
  browser?.addEventListener('storage', onStorage)
  browser?.addEventListener('pagehide', onPageHide)
  browser?.addEventListener('pageshow', onPageShow)
  refresh()

  return {
    capture() {
      const token = Symbol()
      if (!disposed) { captures.add(token); publish(); refresh() }
      return () => { if (!disposed) release(token) }
    },
    isCapturing: refresh,
    dispose,
  }
}
