/**
 * 问答音色回落的纯函数单测（node:test，无额外依赖）。
 * 运行：node --experimental-strip-types --test tests/*.test.ts
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveTourVoiceContext } from '../src/utils/tourPlaybackContext.ts'

test('问答音色回落同时返回首站导游身份', () => {
  assert.deepEqual(resolveTourVoiceContext({ guideId: 'current', providerVoiceId: '' }, { guideId: 'first', providerVoiceId: 'voice-1' }), { guideId: 'first', voiceId: 'voice-1' })
})
