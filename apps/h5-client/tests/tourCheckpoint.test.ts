/**
 * 播放断点与自动推进策略的纯函数单测（node:test，无额外依赖）。
 * 运行：node --experimental-strip-types --test tests/*.test.ts
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  TOUR_CHECKPOINT_TTL_MS,
  clearTourCheckpoint,
  isCheckpointValid,
  readTourCheckpoint,
  writeTourCheckpoint,
  type CheckpointStorage,
  type TourPlaybackCheckpoint,
} from '../src/utils/tourCheckpoint.ts'
import {
  resolveAutoAdvanceMode,
  shouldAdvanceAfterQueue,
  shouldAutoOpenOnApproach,
  shouldAutoStartOnApproach,
} from '../src/utils/tourAutoAdvance.ts'

function fakeStorage(): CheckpointStorage & { map: Map<string, string> } {
  const map = new Map<string, string>()
  return {
    map,
    getItem: key => map.get(key) ?? null,
    setItem: (key, value) => { map.set(key, value) },
    removeItem: key => { map.delete(key) },
  }
}

function sample(overrides: Partial<TourPlaybackCheckpoint> = {}): TourPlaybackCheckpoint {
  return {
    routeId: 'route-1',
    stageId: 'stop-2',
    guideId: 'guide-9',
    skipExtraAudio: false,
    locale: 'zh',
    itemId: 'chapter-2',
    itemType: 'chapter',
    queueIndex: 1,
    currentTimeSeconds: 37,
    sentenceIndex: 0,
    statusBeforeInterrupt: 'playing',
    interruptedBy: 'voice-ask',
    updatedAt: 1_000,
    ...overrides,
  }
}

const expected = { routeId: 'route-1', stageId: 'stop-2', guideId: 'guide-9', skipExtraAudio: false, locale: 'zh' }

test('断点读写与清除按 route+stage 分键', () => {
  const storage = fakeStorage()
  const checkpoint = sample()
  writeTourCheckpoint(storage, checkpoint)
  assert.deepEqual(readTourCheckpoint(storage, 'route-1', 'stop-2'), checkpoint)
  assert.equal(readTourCheckpoint(storage, 'route-1', 'stop-3'), null)
  clearTourCheckpoint(storage, 'route-1', 'stop-2')
  assert.equal(readTourCheckpoint(storage, 'route-1', 'stop-2'), null)
})

test('断点在超期、时钟异常、idle 状态与队列构成变化时失效', () => {
  const now = 10_000_000
  assert.equal(isCheckpointValid(sample({ updatedAt: now - 1 }), expected, now), true)
  assert.equal(isCheckpointValid(sample({ updatedAt: now - TOUR_CHECKPOINT_TTL_MS - 1 }), expected, now), false)
  assert.equal(isCheckpointValid(sample({ updatedAt: now + 60_000 }), expected, now), false)
  assert.equal(isCheckpointValid(sample({ statusBeforeInterrupt: 'idle' }), expected, now), false)
  // 切导游/切语言/切跳过额外音频都会重建队列 → 断点失效
  assert.equal(isCheckpointValid(sample(), { ...expected, guideId: null }, now), false)
  assert.equal(isCheckpointValid(sample(), { ...expected, locale: 'en' }, now), false)
  assert.equal(isCheckpointValid(sample(), { ...expected, skipExtraAudio: true }, now), false)
  assert.equal(isCheckpointValid(sample(), { ...expected, stageId: 'stop-3' }, now), false)
  assert.equal(isCheckpointValid(null, expected, now), false)
})

test('损坏的断点数据不会抛错，按无效处理', () => {
  const storage = fakeStorage()
  storage.setItem('path-seeker:tour-playback:route-1:stop-2', '{not json')
  assert.equal(readTourCheckpoint(storage, 'route-1', 'stop-2'), null)
})

test('自动推进模式：定位可用为 proximity，否则 sequential', () => {
  assert.equal(resolveAutoAdvanceMode({ tracking: true, locationError: false, fixUsable: true }), 'proximity')
  assert.equal(resolveAutoAdvanceMode({ tracking: false, locationError: false, fixUsable: true }), 'sequential')
  assert.equal(resolveAutoAdvanceMode({ tracking: true, locationError: true, fixUsable: true }), 'sequential')
  assert.equal(resolveAutoAdvanceMode({ tracking: true, locationError: false, fixUsable: false }), 'sequential')
  assert.equal(shouldAdvanceAfterQueue('sequential'), true)
  assert.equal(shouldAdvanceAfterQueue('proximity'), false)
})

test('接近自动播放：仅定位可用 + 队列空闲 + 唯一候选 + 未自动播过 + 未被抑制', () => {
  const base = {
    mode: 'proximity' as const,
    status: 'idle' as const,
    autoPlayed: false,
    userPlayed: false,
    dismissed: false,
    candidateCount: 1,
    busy: false,
    suppressed: false,
    ending: false,
  }
  assert.equal(shouldAutoStartOnApproach(base), true)
  assert.equal(shouldAutoStartOnApproach({ ...base, mode: 'sequential' }), false)
  assert.equal(shouldAutoStartOnApproach({ ...base, status: 'playing' }), false)
  assert.equal(shouldAutoStartOnApproach({ ...base, status: 'paused' }), false)
  assert.equal(shouldAutoStartOnApproach({ ...base, autoPlayed: true }), false)
  assert.equal(shouldAutoStartOnApproach({ ...base, userPlayed: true }), false)
  assert.equal(shouldAutoStartOnApproach({ ...base, dismissed: true }), false)
  assert.equal(shouldAutoStartOnApproach({ ...base, candidateCount: 2 }), false)
  assert.equal(shouldAutoStartOnApproach({ ...base, busy: true }), false)
  assert.equal(shouldAutoStartOnApproach({ ...base, suppressed: true }), false)
  assert.equal(shouldAutoStartOnApproach({ ...base, ending: true }), false)
})

test('接近自动打开：已开过/被抑制/忙碌/行程结束时不打开', () => {
  assert.equal(shouldAutoOpenOnApproach({ alreadyOpened: false, suppressed: false, busy: false, ending: false }), true)
  assert.equal(shouldAutoOpenOnApproach({ alreadyOpened: true, suppressed: false, busy: false, ending: false }), false)
  assert.equal(shouldAutoOpenOnApproach({ alreadyOpened: false, suppressed: true, busy: false, ending: false }), false)
  assert.equal(shouldAutoOpenOnApproach({ alreadyOpened: false, suppressed: false, busy: true, ending: false }), false)
  assert.equal(shouldAutoOpenOnApproach({ alreadyOpened: false, suppressed: false, busy: false, ending: true }), false)
})
