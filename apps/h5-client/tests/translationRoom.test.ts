import test from 'node:test'
import assert from 'node:assert/strict'
import { groupRoomMessages, RoomEventCursor, RoomTextFeed } from '../../../packages/ts-shared/src/translation-room.ts'

test('late join excludes old segments, deduplicates events and keeps long IDs as strings', () => {
  const cursor = new RoomEventCursor()
  cursor.accept({ type: 'subscription.ready', roomId: '9223372036854775806', subscriptionVersion: 3, targetLanguage: 'ja', payload: { startSequence: 11 } })
  assert.equal(cursor.accept({ type: 'audio.delta', sequence: 10, subscriptionVersion: 3, targetLanguage: 'ja', eventId: 'old' }), false)
  const first = { type: 'audio.delta', sequence: 11, subscriptionVersion: 3, targetLanguage: 'ja', eventId: '9223372036854775805' }
  assert.equal(cursor.accept(first), true)
  assert.equal(cursor.accept(first), false)
  assert.equal(cursor.accept({ ...first, eventId: 'next', sequence: 12 }), true)
})

test('switch acknowledgement rejects old language and version while accepting room close', () => {
  const cursor = new RoomEventCursor()
  cursor.accept({ type: 'subscription.ready', subscriptionVersion: 1, targetLanguage: 'en', payload: { startSequence: 1 } })
  cursor.accept({ type: 'subscription.changed', subscriptionVersion: 2, targetLanguage: 'de', payload: { startSequence: 8 } })
  assert.equal(cursor.accept({ type: 'audio.delta', sequence: 9, subscriptionVersion: 1, targetLanguage: 'en' }), false)
  assert.equal(cursor.accept({ type: 'audio.delta', sequence: 9, subscriptionVersion: 2, targetLanguage: 'en' }), false)
  assert.equal(cursor.accept({ type: 'audio.delta', sequence: 8, subscriptionVersion: 2, targetLanguage: 'de' }), true)
  assert.equal(cursor.accept({ type: 'room.closed', subscriptionVersion: 2, sequence: 7 }), true)
})

test('host accepts multiple translation languages while listeners retain their own subscription', () => {
  const host = new RoomEventCursor(true)
  const listener = new RoomEventCursor()
  listener.accept({ type: 'subscription.ready', targetLanguage: 'en', subscriptionVersion: 1 })
  for (const language of ['en', 'ja']) {
    const event = { type: 'text.delta', sequence: 1, targetLanguage: language, payload: { content: language } }
    assert.equal(host.accept(event), true)
    assert.equal(listener.accept(event), language === 'en')
  }
})

test('translation feed separates languages and epochs and replaces deltas with final text', () => {
  const feed = new RoomTextFeed()
  const base = { epochId: 'first', sequence: 1 }
  feed.accept({ ...base, type: 'translation.committed', targetLanguage: 'en', payload: { text: '你好' } })
  feed.accept({ ...base, type: 'text.delta', targetLanguage: 'en', payload: { content: 'Hel' } })
  feed.accept({ ...base, type: 'text.delta', targetLanguage: 'ja', payload: { content: 'こんにちは' } })
  feed.accept({ ...base, type: 'text.delta', targetLanguage: 'en', payload: { content: 'lo' } })
  assert.deepEqual(feed.items.map(item => item.text), ['Hello', 'こんにちは'])
  assert.equal(feed.items[0].source, '你好')
  feed.accept({ ...base, type: 'translation.final', targetLanguage: 'en', payload: { text: 'Hello!' } })
  assert.equal(feed.items[0].status, 'complete')
  assert.equal(feed.items[0].text, 'Hello!')
  feed.accept({ ...base, epochId: 'second', type: 'language.error', targetLanguage: 'en', payload: { message: '稍后重试' } })
  assert.equal(feed.items.length, 3)
  assert.equal(feed.items[2].status, 'error')
  assert.equal(feed.items[0].text, 'Hello!')
})

test('translation feed retains the latest sixty entries and clears when leaving', () => {
  const feed = new RoomTextFeed()
  for (let sequence = 1; sequence <= 65; sequence++) feed.accept({ type: 'translation.final', sequence, targetLanguage: 'en', payload: { text: String(sequence) } })
  assert.equal(feed.items.length, 60)
  assert.equal(feed.items[0].sequence, 6)
  assert.equal(feed.items[59].sequence, 65)
  feed.clear()
  assert.deepEqual(feed.items, [])
})

test('chat groups keep chronological segments, share one source across languages and separate recording epochs', () => {
  const feed = new RoomTextFeed()
  const base = { epochId: 'first', sequence: 1 }
  for (const targetLanguage of ['en', 'ja']) {
    feed.accept({ ...base, type: 'translation.committed', targetLanguage, payload: { text: '你好' } })
    feed.accept({ ...base, type: 'text.delta', targetLanguage, payload: { content: targetLanguage === 'en' ? 'Hello' : 'こんにちは' } })
  }
  feed.accept({ ...base, sequence: 2, type: 'translation.committed', targetLanguage: 'en', payload: { text: '下一站' } })
  feed.accept({ ...base, epochId: 'second', type: 'translation.committed', targetLanguage: 'en', payload: { text: '再次开始' } })
  const before = JSON.stringify(feed.items)
  const groups = groupRoomMessages(feed.items)
  assert.deepEqual(groups.map(group => group.id), ['first:1', 'first:2', 'second:1'])
  assert.equal(groups[0].source, '你好')
  assert.deepEqual(groups[0].translations.map(item => item.text), ['Hello', 'こんにちは'])
  assert.equal(groups[1].source, '下一站')
  assert.equal(groups[2].source, '再次开始')
  assert.equal(JSON.stringify(feed.items), before)
})

test('empty final translation terminates as unavailable instead of remaining in generating state', () => {
  for (const text of ['', '   ', undefined]) {
    const feed = new RoomTextFeed()
    feed.accept({ type: 'translation.committed', sequence: 1, targetLanguage: 'en', payload: { text: '让我们来看一看银锭桥。' } })
    feed.accept({ type: 'translation.final', sequence: 1, targetLanguage: 'en', payload: { text } })
    assert.equal(feed.items[0].status, 'error')
    assert.equal(feed.items[0].source, '让我们来看一看银锭桥。')
    assert.match(feed.items[0].text, /未生成译文/)
  }
})

test('empty final preserves received translation deltas without erasing the translation', () => {
  const feed = new RoomTextFeed()
  feed.accept({ type: 'text.delta', sequence: 1, targetLanguage: 'en', payload: { content: 'Let us look at Yinding Bridge.' } })
  feed.accept({ type: 'translation.final', sequence: 1, targetLanguage: 'en', payload: { text: '' } })
  assert.equal(feed.items[0].status, 'complete')
  assert.equal(feed.items[0].text, 'Let us look at Yinding Bridge.')
})

test('empty final cannot turn a failed translation into a completed translation', () => {
  const feed = new RoomTextFeed()
  feed.accept({ type: 'language.error', sequence: 1, targetLanguage: 'en', payload: { message: '翻译超时' } })
  feed.accept({ type: 'translation.final', sequence: 1, targetLanguage: 'en', payload: { text: '' } })
  assert.equal(feed.items[0].status, 'error')
  assert.equal(feed.items[0].text, '翻译超时')
  feed.accept({ type: 'translation.final', sequence: 2, targetLanguage: 'en', payload: { text: 'Next segment.' } })
  assert.equal(feed.items[1].status, 'complete')
  assert.equal(feed.items[1].text, 'Next segment.')
})
