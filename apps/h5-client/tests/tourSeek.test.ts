/**
 * ±15 秒定位的纯函数单测（node:test，无额外依赖）。
 * 运行：node --experimental-strip-types --test tests/*.test.ts
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  estimateSentenceSeconds,
  resolveFileSeekTarget,
  resolveSentenceSeek,
  sentenceOffsets,
  splitSentences,
} from '../src/utils/tourSeek.ts'

test('splitSentences 按句号问号感叹号切分，并合并空白', () => {
  assert.deepEqual(splitSentences('你好。  世界！走吗？'), ['你好。', '世界！', '走吗？'])
  assert.deepEqual(splitSentences('   '), [])
})

test('estimateSentenceSeconds 按语言语速估算，并有最短时长', () => {
  // 中文 5 字/秒：10 字 → 2 秒
  assert.equal(estimateSentenceSeconds('一二三四五六七八九十', 'zh'), 2)
  // 拉丁语系 14 字符/秒：28 字符 → 2 秒
  assert.equal(estimateSentenceSeconds('abcdefghijklmnopqrstuvwxyzab', 'en'), 2)
  // 短句走最短时长，避免估成 0
  assert.equal(estimateSentenceSeconds('好', 'zh'), 1.2)
})

test('sentenceOffsets 累计估算时长与句子一一对应', () => {
  // 中文 5 字/秒：10 字 → 每句 2 秒
  const offsets = sentenceOffsets(['一二三四五六七八九十', '一二三四五六七八九十'], 'zh')
  assert.deepEqual(offsets, [0, 2])
})

test('resolveSentenceSeek：+15 秒落到后面的句子，-15 秒回到前面的句子', () => {
  // 每句 2 秒（10 字），共 10 句
  const sentences = Array.from({ length: 10 }, () => '一二三四五六七八九十')
  assert.deepEqual(resolveSentenceSeek(sentences, 'zh', 0, 15), { index: 7, moved: true })
  assert.deepEqual(resolveSentenceSeek(sentences, 'zh', 5, 3), { index: 6, moved: true })
  assert.deepEqual(resolveSentenceSeek(sentences, 'zh', 5, -3), { index: 3, moved: true })
})

test('resolveSentenceSeek：两端 clamp，边界返回 moved=false', () => {
  const sentences = Array.from({ length: 4 }, () => '一二三四五六七八九十')
  assert.deepEqual(resolveSentenceSeek(sentences, 'zh', 0, -15), { index: 0, moved: false })
  assert.deepEqual(resolveSentenceSeek(sentences, 'zh', 3, 15), { index: 3, moved: false })
  assert.deepEqual(resolveSentenceSeek([], 'zh', 0, 15), { index: 0, moved: false })
})

test('resolveFileSeekTarget：只在本条目内 clamp，不跨条目', () => {
  assert.deepEqual(resolveFileSeekTarget(30, 120, 15), { time: 45, atStart: false, atEnd: false })
  assert.deepEqual(resolveFileSeekTarget(3, 120, -15), { time: 0, atStart: true, atEnd: false })
  assert.deepEqual(resolveFileSeekTarget(118, 120, 15), { time: 120, atStart: false, atEnd: true })
})

test('resolveFileSeekTarget：时长未知时不把位置推到未知区域', () => {
  assert.deepEqual(resolveFileSeekTarget(5, Number.NaN, -15), { time: 0, atStart: true, atEnd: false })
  assert.deepEqual(resolveFileSeekTarget(5, 0, 15), { time: 20, atStart: false, atEnd: false })
})
