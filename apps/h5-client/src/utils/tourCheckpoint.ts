/**
 * 播放断点：把"当前播到哪个条目、第几秒/第几句"存进 sessionStorage，
 * 覆盖抽屉开合、问一问浮层、组件重建与紧随其后的重新挂载（方案 §5.3）。
 *
 * 断点不写服务端、也不写路线进度表：播放位置与"节点完成"是两件事。
 */

import type { TourQueueItemType } from '@/composables/useTourSpeech'

export type TourInterruptReason = 'voice-ask' | 'manual' | 'page-hide'
export type TourPlaybackStatus = 'playing' | 'paused' | 'idle'

export interface TourPlaybackCheckpoint {
  routeId: string
  stageId: string
  guideId: string | null
  skipExtraAudio: boolean
  locale: string
  itemId: string | null
  itemType: TourQueueItemType | null
  queueIndex: number
  /** 文件音频：精确秒数；系统语音恒为 0 */
  currentTimeSeconds: number
  /** 系统语音：当前句序号；文件音频恒为 0 */
  sentenceIndex: number
  statusBeforeInterrupt: TourPlaybackStatus
  interruptedBy: TourInterruptReason
  updatedAt: number
}

/** 断点有效期：超过后丢弃并从头播放 */
export const TOUR_CHECKPOINT_TTL_MS = 6 * 60 * 60 * 1000

const KEY_PREFIX = 'path-seeker:tour-playback'

/** 只为单测注入的存储抽象；生产环境直接传 window.sessionStorage */
export interface CheckpointStorage {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
}

export function checkpointKey(routeId: string, stageId: string) {
  return `${KEY_PREFIX}:${routeId}:${stageId}`
}

export interface CheckpointExpectation {
  routeId: string
  stageId: string
  guideId: string | null
  skipExtraAudio: boolean
  locale: string
}

/**
 * 断点是否仍然可用。命中任一条即失效（方案 §5.4）：
 * 切路线 / 切节点 / 切导游 / 切"跳过额外音频" / 切语言（这些都会重建播放队列，queueIndex 会指错条目）、
 * 超过有效期、updatedAt 晚于当前时间（时钟异常）。
 */
export function isCheckpointValid(
  checkpoint: TourPlaybackCheckpoint | null | undefined,
  expected: CheckpointExpectation,
  now = Date.now(),
  ttlMs = TOUR_CHECKPOINT_TTL_MS,
): boolean {
  if (!checkpoint) return false
  if (checkpoint.routeId !== expected.routeId) return false
  if (checkpoint.stageId !== expected.stageId) return false
  if ((checkpoint.guideId ?? null) !== (expected.guideId ?? null)) return false
  if (checkpoint.skipExtraAudio !== expected.skipExtraAudio) return false
  if (checkpoint.locale !== expected.locale) return false
  if (!Number.isFinite(checkpoint.updatedAt)) return false
  if (checkpoint.updatedAt > now + 1000) return false
  if (now - checkpoint.updatedAt > ttlMs) return false
  if (checkpoint.statusBeforeInterrupt === 'idle') return false
  return true
}

function parseCheckpoint(raw: string | null): TourPlaybackCheckpoint | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<TourPlaybackCheckpoint>
    if (!parsed || typeof parsed !== 'object') return null
    if (typeof parsed.routeId !== 'string' || typeof parsed.stageId !== 'string') return null
    return {
      routeId: parsed.routeId,
      stageId: parsed.stageId,
      guideId: parsed.guideId ?? null,
      skipExtraAudio: Boolean(parsed.skipExtraAudio),
      locale: String(parsed.locale ?? 'zh'),
      itemId: parsed.itemId ?? null,
      itemType: parsed.itemType ?? null,
      queueIndex: Number.isFinite(parsed.queueIndex) ? Number(parsed.queueIndex) : 0,
      currentTimeSeconds: Number.isFinite(parsed.currentTimeSeconds) ? Number(parsed.currentTimeSeconds) : 0,
      sentenceIndex: Number.isFinite(parsed.sentenceIndex) ? Number(parsed.sentenceIndex) : 0,
      statusBeforeInterrupt: parsed.statusBeforeInterrupt === 'playing' || parsed.statusBeforeInterrupt === 'paused'
        ? parsed.statusBeforeInterrupt
        : 'idle',
      interruptedBy: parsed.interruptedBy === 'voice-ask' || parsed.interruptedBy === 'page-hide' ? parsed.interruptedBy : 'manual',
      updatedAt: Number.isFinite(parsed.updatedAt) ? Number(parsed.updatedAt) : 0,
    }
  } catch {
    return null
  }
}

export function readTourCheckpoint(
  storage: CheckpointStorage | null | undefined,
  routeId: string,
  stageId: string,
): TourPlaybackCheckpoint | null {
  if (!storage || !routeId || !stageId) return null
  try {
    return parseCheckpoint(storage.getItem(checkpointKey(routeId, stageId)))
  } catch {
    return null
  }
}

export function writeTourCheckpoint(
  storage: CheckpointStorage | null | undefined,
  checkpoint: TourPlaybackCheckpoint,
): void {
  if (!storage) return
  try {
    storage.setItem(checkpointKey(checkpoint.routeId, checkpoint.stageId), JSON.stringify(checkpoint))
  } catch {
    // 隐私模式 / 配额不足：断点退化为内存态，不影响播放
  }
}

export function clearTourCheckpoint(
  storage: CheckpointStorage | null | undefined,
  routeId: string,
  stageId: string,
): void {
  if (!storage || !routeId || !stageId) return
  try {
    storage.removeItem(checkpointKey(routeId, stageId))
  } catch {
    // ignore
  }
}

/** 取当前环境的 sessionStorage；不可用时返回 null（SSR / 隐私模式） */
export function browserCheckpointStorage(): CheckpointStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage
  } catch {
    return null
  }
}
