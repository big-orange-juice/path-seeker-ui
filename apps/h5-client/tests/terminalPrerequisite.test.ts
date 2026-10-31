import test from 'node:test'
import assert from 'node:assert/strict'
import { canAutoTriggerStop, mergeVisitArrivalProgress } from '../../../packages/ts-shared/src/tour-auto-trigger.ts'

test('迟到的播放进度响应不撤回前序到访记录，新游览不继承旧解锁条件', () => {
  const visited = { visitId: 'visit-1', visitedStageIds: ['391000000000000012'], completedStageIds: [] }
  const oldPlaybackResponse = { visitId: 'visit-1', currentStageId: 'other', visitedStageIds: [], completedStageIds: [] }
  const merged = mergeVisitArrivalProgress(visited, oldPlaybackResponse)
  assert.deepEqual(merged.visitedStageIds, visited.visitedStageIds)
  assert.equal(merged.currentStageId, 'other')
  const stop = { id: '391000000000000013', autoTriggerPrerequisiteStageId: visited.visitedStageIds[0] }
  const stops = [{ id: visited.visitedStageIds[0]! }, stop]
  assert.equal(canAutoTriggerStop(stop, stops, merged.visitedStageIds), true)
  const fresh = mergeVisitArrivalProgress(visited, { ...oldPlaybackResponse, visitId: 'visit-2' })
  assert.equal(canAutoTriggerStop(stop, stops, fresh.visitedStageIds), false)
})
