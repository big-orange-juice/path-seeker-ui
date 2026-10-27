import test from 'node:test'
import assert from 'node:assert/strict'
import { createPlaybackFocus } from '../src/utils/playbackFocus.ts'

test('room, tour and private ask take exclusive focus without an old release clearing the new owner', () => {
  const focus = createPlaybackFocus()
  const interrupted: string[] = []
  const room = focus.channel('room', () => { interrupted.push('room'); room.release() })
  const tour = focus.channel('tour', () => { interrupted.push('tour'); tour.release() })
  const ask = focus.channel('ask', () => { interrupted.push('ask'); ask.release() })
  room.claim()
  room.claim()
  assert.deepEqual(interrupted, [])
  tour.claim()
  ask.claim()
  room.release()
  assert.equal(focus.current(), 'ask')
  room.claim()
  assert.deepEqual(interrupted, ['room', 'tour', 'ask'])
  assert.equal(focus.current(), 'room')
  room.release()
  assert.equal(focus.current(), null)
  assert.equal(tour.isCurrent(), false)
})
