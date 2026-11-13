import type { RouteVisit } from '../types/clientCatalog'

export interface TourAudioOptions {
  roomId: string
  visitId: string
  routeId: string
  language: string
  guideId?: string | null
  following: boolean
  autoplay: boolean
  paused: boolean
  roomMuted: boolean
  skipExtra: boolean
  lockContent: boolean
}

export interface TourAudioSpan {
  start: number
  end: number
  kind: string
  stageId: string | null
  itemId: string | null
  title: string | null
  itemStart: number
  duration: number
}

export interface TourAudioState {
  sessionId: string
  streamId: string
  revision: number
  status: string
  visitId: string
  routeId: string
  stageId: string | null
  itemId: string | null
  itemTitle: string | null
  itemTimeSeconds: number
  itemDurationSeconds: number
  mediaTimeSeconds: number
  paused: boolean
  held: boolean
  roomAudioPlaying: boolean
  queue: { stageId: string; status: string }[]
  visit: RouteVisit
  timeline: TourAudioSpan[]
  error: string | null
}

export interface CreatedTourAudio {
  sessionId: string
  mediaUrl: string
  state: TourAudioState
}

export interface TourAudioSnapshot {
  active: boolean
  creating: boolean
  recovering: boolean
  paused: boolean
  held: boolean
  playing: boolean
  blocked: boolean
  error: string
  state: TourAudioState | null
  audible: { kind: string; stageId: string | null; title: string | null; time: number; duration: number } | null
}

interface TourAudioDependencies {
  request: <Result>(path: string, method: 'GET' | 'POST' | 'DELETE', data?: object) => Promise<Result>
  mediaUrl: (path: string) => string
  account: () => string
  audio: () => HTMLAudioElement
  publish: (snapshot: TourAudioSnapshot) => void
  claim: () => void
  release: () => void
  recoverRoom: (roomId: string) => Promise<boolean>
}

interface Owner {
  key: string
  account: string
  options: TourAudioOptions
  id: string
  url: string
  state: TourAudioState | null
  intent: number
  paused: boolean
  held: boolean
  previousStream: string
  media: HTMLAudioElement | null
  commands: Promise<unknown>
  pending: Promise<TourAudioState | null> | null
}

const cancelled = () => Object.assign(Error('讲解会话已变更'), { cancelled: true })
export const isTourAudioCancelled = (error: unknown) => Boolean((error as { cancelled?: boolean } | null)?.cancelled)
const endedStatuses = ['closed', 'ended', 'expired']

export function createTourAudioSession(dependencies: TourAudioDependencies) {
  let owner: Owner | null = null
  let creation: Promise<unknown> = Promise.resolve()
  let timer: ReturnType<typeof setTimeout> | undefined
  let foreground = true
  let recovering = false
  let blocked = false
  let error = ''
  let refreshPending: Promise<void> | null = null
  let realignment: Promise<void> | null = null
  let requestSequence = 0
  let prepared: HTMLAudioElement | null = null

  const current = (target: Owner) => owner === target && target.account === dependencies.account()
  const path = (target: Owner) => `/TourAudioSessions/${encodeURIComponent(target.id)}`

  function snapshot(): TourAudioSnapshot {
    const state = owner?.state ?? null
    const media = owner?.media
    const time = media?.currentTime ?? 0
    const validStream = state && state.streamId !== owner?.previousStream && media
    let span = validStream ? state.timeline?.find(item => time >= item.start && time < item.end) : undefined
    const tail = validStream ? state.timeline?.[state.timeline.length - 1] : undefined
    if (!span && tail && time >= tail.end && time - tail.end < 3) span = tail
    return {
      active: Boolean(owner), creating: Boolean(owner?.pending), recovering, blocked, error,
      paused: Boolean(owner?.paused), held: Boolean(owner?.held),
      playing: Boolean(media && !media.paused && !owner?.paused && !owner?.held && !blocked && !error), state,
      audible: span ? { kind: span.kind, stageId: span.stageId, title: span.title,
        time: Math.max(0, Math.min(span.duration, span.itemStart + time - span.start)), duration: span.duration } : null,
    }
  }

  const publish = () => dependencies.publish(snapshot())

  function disposeMedia(target: Owner) {
    const media = target.media
    target.media = null
    if (!media) return
    media.onplay = media.onplaying = media.onpause = media.onerror = media.onended = media.ontimeupdate = null
    media.pause()
    media.removeAttribute('src')
    media.load()
  }

  function revoke(target: Owner) {
    if (target.id) void dependencies.request(path(target), 'DELETE').catch(() => {})
  }

  function stop(preservePrepared = false) {
    const previous = owner
    owner = null
    clearTimeout(timer)
    refreshPending = null
    realignment = null
    recovering = blocked = false
    error = ''
    if (previous) { disposeMedia(previous); revoke(previous) }
    if (!preservePrepared && prepared) {
      prepared.pause()
      prepared.removeAttribute('src')
      prepared.load()
      prepared = null
    }
    dependencies.release()
    publish()
  }

  function schedule() {
    clearTimeout(timer)
    if (owner && foreground) timer = setTimeout(() => { void refresh() }, 2000)
  }

  function accept(target: Owner, state: TourAudioState) {
    if (!current(target) || state.sessionId !== target.id || state.visitId !== target.options.visitId || state.routeId !== target.options.routeId) return false
    if (target.state && state.revision < target.state.revision) return false
    target.state = state
    if (endedStatuses.includes(state.status)) {
      stop()
      if (state.visit.status === 1) {
        void dependencies.recoverRoom(target.options.roomId).then(restored => {
          if (!owner && restored && target.account === dependencies.account()) { error = '讲解连接已结束，请重新连接'; publish() }
        }).catch(failure => {
          if (!owner && target.account === dependencies.account()) { error = failure instanceof Error ? failure.message : '房间连接暂不可用'; publish() }
        })
      }
      return false
    }
    error = state.error || ''
    publish()
    return true
  }

  async function play(target: Owner) {
    if (!current(target) || target.paused || target.held || !foreground) return
    const media = prepared || target.media || dependencies.audio()
    prepared = null
    disposeMedia(target)
    target.media = media
    target.previousStream = target.state?.streamId ?? ''
    blocked = false
    error = ''
    const valid = () => current(target) && target.media === media
    media.preload = 'none'
    media.src = `${target.url}&connection=h5_${Date.now()}_${++requestSequence}`
    media.onplay = media.onplaying = () => {
      if (!valid()) return
      if (target.paused || target.held || !foreground) { media.pause(); return }
      dependencies.claim()
      blocked = false
      publish()
    }
    media.onpause = () => {
      if (!valid()) return
      if (!target.paused && !target.held) void control('pause').catch(() => {})
      publish()
    }
    media.onerror = media.onended = () => {
      if (valid()) { error = '讲解播放已中断，请重新连接'; publish() }
    }
    media.ontimeupdate = () => { if (valid()) publish() }
    dependencies.claim()
    publish()
    try { await media.play() }
    catch {
      if (valid()) { blocked = true; error = '请点击播放或重新连接，继续收听讲解'; publish() }
    }
  }

  async function start(options: TourAudioOptions): Promise<TourAudioState | null> {
    if (![options.roomId, options.visitId, options.routeId].every(value => typeof value === 'string' && value.length > 0)) throw Error('请先加入房间并开始行程')
    const account = dependencies.account()
    const key = [account, options.roomId, options.visitId, options.routeId, options.language, options.guideId || ''].join('|')
    if (owner?.key === key && current(owner)) return owner.pending ?? owner.state
    stop(true)
    const target: Owner = { key, account, options: { ...options }, id: '', url: '', state: null,
      intent: 0, paused: options.paused || !foreground, held: false, previousStream: '', media: null,
      commands: Promise.resolve(), pending: null }
    owner = target
    const previousCreation = creation
    const pending = (async () => {
      try {
        await previousCreation.catch(() => {})
        if (!current(target)) throw cancelled()
        let result: CreatedTourAudio
        try { result = await dependencies.request('/TourAudioSessions', 'POST', { ...options, paused: target.paused }) }
        catch (failure) {
          const denied = failure as { statusCode?: number; code?: number; message?: string }
          if (!current(target)) throw cancelled()
          if (denied.statusCode !== 403 || denied.code !== 10003 || denied.message !== '请先加入房间') throw failure
          const restored = await dependencies.recoverRoom(options.roomId)
          if (!current(target)) throw cancelled()
          if (!restored) { stop(); return null }
          result = await dependencies.request('/TourAudioSessions', 'POST', { ...options, paused: target.paused })
        }
        if (typeof result.sessionId !== 'string' || !result.sessionId) throw Error('持续讲解会话返回无效')
        target.id = result.sessionId
        if (!current(target)) { revoke(target); throw cancelled() }
        target.url = dependencies.mediaUrl(result.mediaUrl)
        if (!accept(target, result.state)) throw cancelled()
        target.pending = null
        if (!target.paused && !target.held) await play(target)
        publish()
        schedule()
        return target.state
      } catch (failure) {
        if (!current(target)) throw cancelled()
        stop()
        error = failure instanceof Error ? failure.message : '讲解连接失败，请重试'
        publish()
        throw failure
      }
    })()
    target.pending = pending
    creation = pending
    publish()
    return pending
  }

  function control(command: string, values: object = {}): Promise<TourAudioState | null> {
    const target = owner
    if (!target || !current(target)) return Promise.resolve(null)
    if (command === 'pause') target.paused = true
    if (command === 'resume') target.paused = false
    if (command === 'hold') target.held = true
    if (command === 'release') target.held = false
    if (command === 'realign') { target.paused = false; target.held = false }
    if (['realign', 'resume', 'release', 'pause', 'hold'].includes(command)) target.intent++
    if (command === 'realign') disposeMedia(target)
    if (['pause', 'hold'].includes(command)) target.media?.pause()
    const intent = target.intent
    publish()
    const run = async () => {
      if (target.pending) await target.pending
      if (!current(target)) throw cancelled()
      if (['realign', 'resume', 'release', 'reconnect'].includes(command) && intent !== target.intent) throw cancelled()
      const result = await dependencies.request<TourAudioState>(`${path(target)}/control`, 'POST', {
        ...values, command, requestId: `h5_${Date.now()}_${++requestSequence}`,
      })
      if (!current(target)) throw cancelled()
      accept(target, result)
      if (!current(target) || intent !== target.intent && ['realign', 'resume', 'release', 'reconnect'].includes(command)) throw cancelled()
      return target.state
    }
    const operation = target.commands.then(run)
    target.commands = operation.catch(() => {})
    return operation.catch(failure => {
      if (current(target) && !isTourAudioCancelled(failure)) {
        const missing = failure as { statusCode?: number; code?: number }
        if (missing.statusCode === 404 || missing.code === 10004) stop()
        error = failure instanceof Error ? failure.message : '讲解操作失败，请重试'
        publish()
      }
      throw failure
    })
  }

  async function resume() {
    const target = owner
    if (!target || !current(target) || !foreground) return
    if (target.held) await control('release')
    const operation = control('resume'), intent = target.intent
    const state = await operation
    if (!state || !current(target) || intent !== target.intent || target.paused || target.held) return
    await control('reconnect')
    if (current(target) && intent === target.intent && !target.paused && !target.held) {
      await play(target)
    }
  }

  function realign() {
    if (realignment) return realignment
    const target = owner
    if (!target || !current(target)) return Promise.resolve()
    const operation = control('realign'), intent = target.intent
    let pending!: Promise<void>
    pending = (async () => {
      recovering = true
      publish()
      try {
        await operation
        if (!current(target) || intent !== target.intent || target.paused || target.held) throw cancelled()
        await resume()
      } finally {
        if (realignment === pending) { realignment = null; recovering = false; publish() }
      }
    })()
    realignment = pending
    return pending
  }

  function refresh(): Promise<void> {
    if (refreshPending) return refreshPending
    const target = owner
    if (!target?.id || !current(target)) return Promise.resolve()
    let pending!: Promise<void>
    pending = (async () => {
      try {
        const state = await dependencies.request<TourAudioState>(path(target), 'GET')
        if (!accept(target, state)) return
        const media = target.media
        if (media && !media.paused && !target.paused && !target.held && state.streamId !== target.previousStream && Number.isFinite(media.currentTime) && media.currentTime > 0) {
          await control('ack', { mediaTimeSeconds: media.currentTime, streamId: state.streamId })
        }
      } catch (failure) {
        if (current(target) && !isTourAudioCancelled(failure)) {
          const missing = failure as { statusCode?: number; code?: number }
          if (missing.statusCode === 404 || missing.code === 10004) stop()
          error = failure instanceof Error ? failure.message : '讲解连接失败，请重试'
          publish()
        }
      } finally {
        if (refreshPending === pending) { refreshPending = null; schedule() }
      }
    })()
    refreshPending = pending
    return pending
  }

  function setForeground(value: boolean) {
    foreground = value
    clearTimeout(timer)
    if (!value && owner) void control('pause').catch(() => {})
    if (value) void refresh()
  }

  function unlock() {
    if (prepared) return
    const bytes = new Uint8Array(364)
    const view = new DataView(bytes.buffer)
    const text = (offset: number, value: string) => { for (let index = 0; index < value.length; index++) bytes[offset + index] = value.charCodeAt(index) }
    text(0, 'RIFF'); view.setUint32(4, bytes.length - 8, true); text(8, 'WAVE'); text(12, 'fmt ')
    view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true)
    view.setUint32(24, 16000, true); view.setUint32(28, 32000, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true)
    text(36, 'data'); view.setUint32(40, bytes.length - 44, true)
    const media = prepared = dependencies.audio()
    media.src = `data:audio/wav;base64,${btoa(Array.from(bytes, value => String.fromCharCode(value)).join(''))}`
    void media.play().then(() => { if (prepared === media) media.pause() }).catch(() => {})
  }

  return { start, stop, control, resume, realign, refresh, setForeground, snapshot, unlock }
}
