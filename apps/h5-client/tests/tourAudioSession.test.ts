import test, { type TestContext } from 'node:test'
import assert from 'node:assert/strict'
import { createTourAudioSession, type TourAudioOptions, type TourAudioState, type TourAudioSnapshot } from '../src/services/tourAudioSession.ts'

const options: TourAudioOptions = { roomId: '396571645583691776', visitId: '2121122456927342592', routeId: '2116113373455323136',
  language: 'zh', following: true, autoplay: true, paused: false, roomMuted: false, skipExtra: false, lockContent: false }
const stageA = '2119694342099701760', stageB = '2119694342099701761'
const tick = () => new Promise(resolve => setImmediate(resolve))
function deferred<Result>() {
  let resolve!: (value: Result) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<Result>((done, fail) => { resolve = done; reject = fail })
  return { promise, resolve, reject }
}
function fixture(context: TestContext) {
  let revision = 0, account = 'account-a', failPlay = false, recovered = true, recoveryCalls = 0
  let state: TourAudioState = {
    sessionId: 'session-a', streamId: '', revision: 0, status: 'created', visitId: options.visitId, routeId: options.routeId,
    stageId: stageA, itemId: 'chapter-a', itemTitle: '节点 A', itemTimeSeconds: 10, itemDurationSeconds: 60, mediaTimeSeconds: 10,
    paused: false, held: false, roomAudioPlaying: false, queue: [{ stageId: stageA, status: 'playing' }],
    visit: { visitId: options.visitId, routeId: options.routeId, destinationId: null, locale: 'zh', status: 1, currentStageId: stageA, completedStageIds: [] },
    timeline: [], error: null,
  }
  const requests: { path: string; method: string; data: Record<string, unknown> }[] = []
  const media: Media[] = []
  let intercept: ((entry: typeof requests[number]) => Promise<unknown> | undefined) | undefined
  class Media {
    src = ''; paused = true; currentTime = 0; preload = ''
    onplay: (() => void) | null = null; onplaying: (() => void) | null = null
    onpause: (() => void) | null = null; onerror: (() => void) | null = null
    onended: (() => void) | null = null; ontimeupdate: (() => void) | null = null
    play() { if (failPlay) return Promise.reject(Error('NotAllowedError')); this.paused = false; this.onplay?.(); return Promise.resolve() }
    pause() { const changed = !this.paused; this.paused = true; if (changed) this.onpause?.() }
    removeAttribute() { this.src = '' }
    load() {}
  }
  let snapshot!: TourAudioSnapshot
  const session = createTourAudioSession({
    request: async <Result>(path: string, method: 'GET' | 'POST' | 'DELETE', data?: object) => {
      const entry = { path, method, data: (data || {}) as Record<string, unknown> }; requests.push(entry)
      const intercepted = intercept?.(entry)
      if (intercepted) return await intercepted as Result
      if (method === 'DELETE') return null as Result
      if (path === '/TourAudioSessions') return { sessionId: state.sessionId, mediaUrl: '/TourAudioSessions/session-a/media.mp3?ticket=secret', state } as Result
      const command = entry.data.command
      if (command === 'realign') state = { ...state, stageId: null, itemId: null, queue: [], timeline: [] }
      if (command === 'pause') state = { ...state, paused: true }
      if (command === 'resume') state = { ...state, paused: false }
      if (command === 'hold') state = { ...state, held: true }
      if (command === 'release') state = { ...state, held: false }
      state = { ...state, revision: ++revision }
      return state as Result
    },
    mediaUrl: path => `https://example.test/api${path}`, account: () => account,
    audio: () => { const audio = new Media(); media.push(audio); return audio as unknown as HTMLAudioElement },
    publish: value => { snapshot = value }, claim() {}, release() {},
    recoverRoom: async () => { recoveryCalls++; return recovered },
  })
  context.after(() => session.stop())
  return { session, requests, media, snapshot: () => snapshot, setAccount: (value: string) => { account = value },
    setState: (values: Partial<TourAudioState>) => { state = { ...state, ...values, revision: ++revision } },
    setIntercept: (callback: typeof intercept) => { intercept = callback }, setFailPlay: (value: boolean) => { failPlay = value },
    setRecovered: (value: boolean) => { recovered = value }, recoveryCalls: () => recoveryCalls, state: () => state }
}

test('continuous session keeps large identifiers as strings and reuses the same pending creation', async context => {
  const fixtureState = fixture(context)
  const creation = deferred<unknown>()
  fixtureState.setIntercept(entry => entry.path === '/TourAudioSessions' ? creation.promise : undefined)
  const first = fixtureState.session.start(options), second = fixtureState.session.start(options)
  await tick()
  assert.equal(fixtureState.requests.length, 1)
  assert.equal(fixtureState.requests[0].data.visitId, options.visitId)
  assert.equal(fixtureState.requests[0].data.roomId, options.roomId)
  creation.resolve({ sessionId: 'session-a', mediaUrl: '/TourAudioSessions/session-a/media.mp3?ticket=x', state: fixtureState.state() })
  await Promise.all([first, second])
  assert.equal(fixtureState.media.length, 1)
})

test('manual reconnect clears unfinished backlog and the audible node changes only with the new stream timeline', async context => {
  const fixtureState = fixture(context)
  await fixtureState.session.start(options)
  const firstMedia = fixtureState.media[0]
  firstMedia.currentTime = 35
  const first = fixtureState.session.realign(), second = fixtureState.session.realign()
  assert.equal(first, second)
  await first
  assert.deepEqual(fixtureState.requests.filter(entry => entry.data.command).map(entry => entry.data.command), ['realign', 'resume', 'reconnect'])
  assert.equal(firstMedia.src, '')
  assert.deepEqual(fixtureState.snapshot().state?.queue, [])
  assert.equal(fixtureState.snapshot().audible, null)
  fixtureState.setState({ status: 'streaming', streamId: 'stream-b', stageId: stageB,
    queue: [{ stageId: stageB, status: 'playing' }], timeline: [{ start: 0, end: 60, kind: 'route', stageId: stageB, itemId: 'chapter-b', title: '节点 B', itemStart: 0, duration: 60 }] })
  await fixtureState.session.refresh()
  assert.equal(fixtureState.snapshot().audible?.stageId, stageB)
  assert.equal(fixtureState.snapshot().audible?.time, 0)
  assert.equal(fixtureState.media.length, 2)
})

test('a question during realignment cancels the late response before resume or media replacement', async context => {
  const fixtureState = fixture(context)
  await fixtureState.session.start(options)
  const response = deferred<TourAudioState>()
  fixtureState.setIntercept(entry => entry.data.command === 'realign' ? response.promise : undefined)
  const reconnect = fixtureState.session.realign()
  await tick()
  const held = fixtureState.session.control('hold')
  response.resolve(fixtureState.state())
  await assert.rejects(reconnect, { cancelled: true })
  await held
  assert.equal(fixtureState.snapshot().held, true)
  assert.equal(fixtureState.requests.some(entry => entry.data.command === 'resume'), false)
  assert.equal(fixtureState.media.length, 1)
})

test('leaving or closing the room while a session is being created revokes the late session without playing', async context => {
  const fixtureState = fixture(context)
  const response = deferred<unknown>()
  fixtureState.setIntercept(entry => entry.path === '/TourAudioSessions' ? response.promise : undefined)
  const start = fixtureState.session.start(options)
  await tick()
  fixtureState.session.stop()
  response.resolve({ sessionId: 'session-a', mediaUrl: '/TourAudioSessions/session-a/media.mp3?ticket=x', state: fixtureState.state() })
  await assert.rejects(start, { cancelled: true })
  assert.equal(fixtureState.media.length, 0)
  assert.equal(fixtureState.requests.at(-1)?.method, 'DELETE')
})

test('background pause persists on return and explicit reconnect discards the old node', async context => {
  const fixtureState = fixture(context)
  await fixtureState.session.start(options)
  fixtureState.session.setForeground(false)
  await tick()
  assert.equal(fixtureState.media[0].paused, true)
  fixtureState.session.setForeground(true)
  await tick()
  assert.equal(fixtureState.snapshot().paused, true)
  assert.equal(fixtureState.media.length, 1)
  await fixtureState.session.realign()
  assert.equal(fixtureState.media.length, 2)
  assert.deepEqual(fixtureState.snapshot().state?.queue, [])
})

test('backgrounding during creation prevents a late media response from autoplaying', async context => {
  const fixtureState = fixture(context)
  const response = deferred<unknown>()
  fixtureState.setIntercept(entry => entry.path === '/TourAudioSessions' ? response.promise : undefined)
  const start = fixtureState.session.start(options)
  await tick()
  fixtureState.session.setForeground(false)
  response.resolve({ sessionId: 'session-a', mediaUrl: '/TourAudioSessions/session-a/media.mp3?ticket=x', state: fixtureState.state() })
  await start
  await tick()
  assert.equal(fixtureState.media.length, 0)
  assert.equal(fixtureState.snapshot().paused, true)
  assert.ok(fixtureState.requests.some(entry => entry.data.command === 'pause'))
})

test('exact expired-membership error rejoins the same room once before retrying creation', async context => {
  const fixtureState = fixture(context)
  let attempts = 0
  fixtureState.setIntercept(entry => entry.path === '/TourAudioSessions' && !attempts++
    ? Promise.reject(Object.assign(Error('请先加入房间'), { statusCode: 403, code: 10003 })) : undefined)
  await fixtureState.session.start(options)
  assert.equal(fixtureState.recoveryCalls(), 1)
  assert.equal(fixtureState.media.length, 1)
})

test('confirmed room ending after lost membership is a normal inactive state', async context => {
  const fixtureState = fixture(context)
  fixtureState.setRecovered(false)
  fixtureState.setIntercept(entry => entry.path === '/TourAudioSessions'
    ? Promise.reject(Object.assign(Error('请先加入房间'), { statusCode: 403, code: 10003 })) : undefined)
  assert.equal(await fixtureState.session.start(options), null)
  assert.equal(fixtureState.snapshot().error, '')
  assert.equal(fixtureState.snapshot().active, false)
  assert.equal(fixtureState.media.length, 0)
})

test('unrelated permission failures remain errors and never imply room dismissal', async context => {
  const fixtureState = fixture(context)
  fixtureState.setIntercept(entry => entry.path === '/TourAudioSessions'
    ? Promise.reject(Object.assign(Error('无权访问此路线'), { statusCode: 403, code: 10003 })) : undefined)
  await assert.rejects(fixtureState.session.start(options), /无权访问此路线/)
  assert.equal(fixtureState.recoveryCalls(), 0)
  assert.equal(fixtureState.snapshot().error, '无权访问此路线')
})

test('browser autoplay refusal is recoverable by a manual playback action', async context => {
  const fixtureState = fixture(context)
  fixtureState.setFailPlay(true)
  await fixtureState.session.start(options)
  assert.equal(fixtureState.snapshot().blocked, true)
  fixtureState.setFailPlay(false)
  await fixtureState.session.resume()
  assert.equal(fixtureState.snapshot().blocked, false)
  assert.equal(fixtureState.snapshot().playing, true)
})

test('manual activation prepares an audio element synchronously and reuses it after async reconnection', async context => {
  const fixtureState = fixture(context)
  await fixtureState.session.start(options)
  fixtureState.session.unlock()
  const prepared = fixtureState.media[1]
  assert.match(prepared.src, /^data:audio\/wav/)
  assert.equal(prepared.paused, false)
  await fixtureState.session.realign()
  assert.equal(fixtureState.media.length, 2)
  assert.match(prepared.src, /TourAudioSessions/)
  assert.equal(prepared.paused, false)
})

test('an ended tour session verifies room membership instead of assuming the driver dismissed it', async context => {
  const fixtureState = fixture(context)
  await fixtureState.session.start(options)
  fixtureState.setState({ status: 'closed' })
  await fixtureState.session.refresh()
  await tick()
  assert.equal(fixtureState.recoveryCalls(), 1)
  assert.equal(fixtureState.snapshot().active, false)
  assert.equal(fixtureState.snapshot().error, '讲解连接已结束，请重新连接')
})

test('account switch rejects a late session response and never acquires playback', async context => {
  const fixtureState = fixture(context)
  const response = deferred<unknown>()
  fixtureState.setIntercept(entry => entry.path === '/TourAudioSessions' ? response.promise : undefined)
  const start = fixtureState.session.start(options)
  await tick()
  fixtureState.setAccount('account-b')
  response.resolve({ sessionId: 'session-a', mediaUrl: '/TourAudioSessions/session-a/media.mp3?ticket=x', state: fixtureState.state() })
  await assert.rejects(start, { cancelled: true })
  assert.equal(fixtureState.media.length, 0)
})
