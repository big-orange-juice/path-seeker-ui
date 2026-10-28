/**
 * 自动推进主流程与范围版本判定的纯函数单测（node:test，无额外依赖）。
 * 运行：node --experimental-strip-types --test tests/*.test.ts
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  decideQueueFinishedOutcome,
  isRangeVersionChanged,
  resolveAutoAdvanceMode,
  shouldAdvanceAfterQueue,
} from '../src/utils/tourAutoAdvance.ts'
import { hasStableApproach, resolveTourVoiceContext } from '../src/utils/tourPlaybackContext.ts'

test('问答音色回落同时返回首站导游身份，并拒绝未成熟停留', () => {
  assert.deepEqual(resolveTourVoiceContext({ guideId: 'current', providerVoiceId: '' }, { guideId: 'first', providerVoiceId: 'voice-1' }), { guideId: 'first', voiceId: 'voice-1' })
  assert.equal(hasStableApproach(1000, 2499, 1500), false)
  assert.equal(hasStableApproach(1000, 2500, 1500), true)
})

test('队列结束后的去向：浏览模式停在原地，不写完成也不前进', () => {
  assert.equal(decideQueueFinishedOutcome({ browsing: true, visitInProgress: true, mode: 'proximity', hasNextStop: true }), 'browse')
  assert.equal(decideQueueFinishedOutcome({ browsing: true, visitInProgress: true, mode: 'sequential', hasNextStop: true }), 'browse')
})

test('队列结束后的去向：定位不可用（sequential）标记完成后进入下一站', () => {
  assert.equal(decideQueueFinishedOutcome({ browsing: false, visitInProgress: true, mode: 'sequential', hasNextStop: true }), 'advance')
})

test('队列结束后的去向：定位可用（proximity）只标记完成，等接近触发', () => {
  assert.equal(decideQueueFinishedOutcome({ browsing: false, visitInProgress: true, mode: 'proximity', hasNextStop: true }), 'stay')
})

test('队列结束后的去向：末站结束行程，行程已结束时不再动', () => {
  assert.equal(decideQueueFinishedOutcome({ browsing: false, visitInProgress: true, mode: 'sequential', hasNextStop: false }), 'finish')
  assert.equal(decideQueueFinishedOutcome({ browsing: false, visitInProgress: true, mode: 'proximity', hasNextStop: false }), 'finish')
  assert.equal(decideQueueFinishedOutcome({ browsing: false, visitInProgress: false, mode: 'sequential', hasNextStop: true }), 'stay')
})

test('自动推进模式与队列结束动作保持一致', () => {
  const proximity = resolveAutoAdvanceMode({ tracking: true, locationError: false, fixUsable: true })
  const sequential = resolveAutoAdvanceMode({ tracking: false, locationError: false, fixUsable: false })
  assert.equal(shouldAdvanceAfterQueue(proximity), false)
  assert.equal(shouldAdvanceAfterQueue(sequential), true)
  assert.equal(decideQueueFinishedOutcome({ browsing: false, visitInProgress: true, mode: proximity, hasNextStop: true }), 'stay')
  assert.equal(decideQueueFinishedOutcome({ browsing: false, visitInProgress: true, mode: sequential, hasNextStop: true }), 'advance')
})

test('景点范围版本变化时允许重新评估自动打开/自动播放', () => {
  assert.equal(isRangeVersionChanged(3, 4), true)
  assert.equal(isRangeVersionChanged(3, 3), false)
  // 后端没下发版本（老数据）时不误判为变化
  assert.equal(isRangeVersionChanged(3, null), false)
  assert.equal(isRangeVersionChanged(3, undefined), false)
  // 新节点首次记录（0）遇到任意版本视为变化，触发一次重新评估
  assert.equal(isRangeVersionChanged(0, 1), true)
})
