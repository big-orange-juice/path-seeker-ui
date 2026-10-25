import test from 'node:test'
import assert from 'node:assert/strict'
import { RoomEventCursor } from '../../../packages/ts-shared/src/translation-room.ts'

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
