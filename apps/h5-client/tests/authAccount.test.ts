import test, { after, type TestContext } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdtemp, rm } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createPinia, setActivePinia } from 'pinia'

const require = createRequire(import.meta.url)
const { build } = createRequire(require.resolve('vite'))('esbuild')
const project = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const temporary = await mkdtemp(resolve(project, 'tests/.runtime-'))
after(async () => { await rm(temporary, { recursive: true, force: true }) })

await build({
  stdin: {
    contents: "export { useAuthStore } from './src/stores/useAuthStore'; export { getAccessToken } from './src/services/authSession'; export { roomRequest } from './src/services/translationRoom'; export { request } from './src/services/http';",
    resolveDir: project,
  },
  bundle: true, platform: 'node', format: 'esm', outfile: resolve(temporary, 'authAccount.mjs'),
  external: ['vue', 'pinia'],
  alias: { '@': resolve(project, 'src'), '@path-seeker/ts-shared': resolve(project, '../../packages/ts-shared/src/index.ts') },
  define: { 'import.meta.env.VITE_API_BASE_URL': '"https://fixture.test/api"' },
})
const { useAuthStore, getAccessToken, roomRequest, request } = await import(pathToFileURL(resolve(temporary, 'authAccount.mjs')).href)

function response(data: object) {
  return Response.json({ code: 0, data })
}

function setup(context: TestContext) {
  setActivePinia(createPinia())
  const store = useAuthStore()
  context.after(() => { store.logout(); store.$dispose() })
  return store
}

test('游客会话可继续游览，但不视为正式账号登录', async context => {
  const store = setup(context)
  assert.equal(store.isAccountLoggedIn, false)
  context.mock.method(globalThis, 'fetch', async () => response({
    userId: '9223372036854775806', isGuest: true, accessToken: 'guest-token', expiresIn: 3600,
  }))
  await store.loginAsGuest()
  assert.equal(store.isLoggedIn, true)
  assert.equal(store.isGuest, true)
  assert.equal(store.isAccountLoggedIn, false)
  assert.equal(getAccessToken(), 'guest-token')
})

test('游客切换到房主账号后，以新令牌查询房主权限且不再签发游客会话', async context => {
  const store = setup(context)
  let guestRequests = 0
  const permissionTokens: string[] = []
  context.mock.method(globalThis, 'fetch', async (url: string, options: RequestInit) => {
    if (url.endsWith('/GuestLogin')) {
      guestRequests++
      return response({ userId: '9223372036854775806', isGuest: true, accessToken: 'guest-token', expiresIn: 3600 })
    }
    if (url.endsWith('/Login')) {
      assert.deepEqual(JSON.parse(String(options.body)).account, 'host-account')
      return response({ userId: '9223372036854775805', userNo: 'HOST-01', isGuest: false, accessToken: 'host-token', refreshToken: 'host-refresh', expiresIn: 3600 })
    }
    permissionTokens.push(String((options.headers as Record<string, string>).Authorization))
    return response({ canHost: true })
  })
  await store.loginAsGuest()
  await store.login('host-account', 'fixture-password')
  assert.equal(store.isGuest, false)
  assert.equal(store.isAccountLoggedIn, true)
  assert.equal(store.profile.id, '9223372036854775805')
  assert.equal(getAccessToken(), 'host-token')
  assert.equal(await store.ensureGuestSession(), true)
  assert.equal(guestRequests, 1)
  assert.deepEqual(await roomRequest('/host-permission'), { canHost: true })
  assert.deepEqual(permissionTokens, ['Bearer host-token'])
})

test('切换账号失败保留当前身份，退出登录则清除身份和请求令牌', async context => {
  const store = setup(context)
  context.mock.method(globalThis, 'fetch', async (url: string) => {
    if (url.endsWith('/GuestLogin')) return response({ userId: '9223372036854775806', isGuest: true, accessToken: 'guest-token' })
    return Response.json({ code: 10001, message: '账号或密码错误' })
  })
  await store.loginAsGuest()
  assert.equal(await store.login('host-account', 'incorrect-password'), null)
  assert.equal(store.isGuest, true)
  assert.equal(store.isAccountLoggedIn, false)
  assert.equal(getAccessToken(), 'guest-token')
  assert.equal(store.error, '账号或密码错误')
  store.logout()
  assert.equal(store.isLoggedIn, false)
  assert.equal(store.isGuest, false)
  assert.equal(store.isAccountLoggedIn, false)
  assert.equal(getAccessToken(), '')
})

function deferredResponse() {
  let resolve!: (value: Response) => void
  const promise = new Promise<Response>(complete => { resolve = complete })
  return { promise, resolve }
}

const hostLogin = { userId: '9223372036854775805', isGuest: false, accessToken: 'host-token', refreshToken: 'host-refresh', expiresIn: 3600 }
const guestLogin = { userId: '9223372036854775806', isGuest: true, accessToken: 'guest-token', refreshToken: 'guest-refresh', expiresIn: 3600 }

test('启动时迟到的游客登录不能覆盖刚完成的正式登录', async context => {
  const store = setup(context)
  const guest = deferredResponse()
  context.mock.method(globalThis, 'fetch', async (url: string) => url.endsWith('/GuestLogin') ? guest.promise : response(hostLogin))
  const bootstrapping = store.ensureGuestSession()
  await store.login('host-account', 'fixture-password')
  guest.resolve(response(guestLogin))
  await bootstrapping
  assert.equal(store.isAccountLoggedIn, true)
  assert.equal(store.profile.id, hostLogin.userId)
  assert.equal(getAccessToken(), hostLogin.accessToken)
})

test('旧游客资料迟到时不能把导航页重新标记为游客', async context => {
  const store = setup(context)
  const profile = deferredResponse()
  context.mock.method(globalThis, 'fetch', async (url: string) => {
    if (url.endsWith('/GuestLogin')) return response(guestLogin)
    if (url.endsWith('/Profile')) return profile.promise
    return response(hostLogin)
  })
  await store.loginAsGuest()
  const loading = store.loadProfile()
  await store.login('host-account', 'fixture-password')
  profile.resolve(response({ id: guestLogin.userId, registerChannel: 5, nickname: '游客' }))
  await loading
  assert.equal(store.isAccountLoggedIn, true)
  assert.equal(store.profile.id, hostLogin.userId)
})

test('旧游客请求的401不能清除新登录账号或触发新的游客登录', async context => {
  const store = setup(context)
  const expired = deferredResponse()
  let guestRequests = 0
  context.mock.method(globalThis, 'fetch', async (url: string) => {
    if (url.endsWith('/GuestLogin')) { guestRequests++; return response(guestLogin) }
    if (url.endsWith('/Login')) return response(hostLogin)
    return expired.promise
  })
  await store.loginAsGuest()
  const oldRequest = request('/fixture')
  await store.login('host-account', 'fixture-password')
  expired.resolve(Response.json({ code: 10002, message: '登录已过期' }, { status: 401 }))
  await assert.rejects(oldRequest)
  assert.equal(store.isAccountLoggedIn, true)
  assert.equal(store.sessionExpiredDialogOpen, false)
  assert.equal(guestRequests, 1)
})

test('旧会话续期失败不能退出新账号，也不能回落到游客身份', async context => {
  const store = setup(context)
  const refreshing = deferredResponse()
  let guestRequests = 0
  context.mock.method(globalThis, 'fetch', async (url: string) => {
    if (url.endsWith('/GuestLogin')) { guestRequests++; return response(guestLogin) }
    if (url.endsWith('/RefreshToken')) return refreshing.promise
    return response(hostLogin)
  })
  await store.loginAsGuest()
  store.expiresAt = 1
  const ensuring = store.ensureGuestSession()
  await store.login('host-account', 'fixture-password')
  refreshing.resolve(Response.json({ code: 10002, message: '续期失败' }, { status: 401 }))
  await ensuring
  assert.equal(store.isAccountLoggedIn, true)
  assert.equal(store.profile.id, hostLogin.userId)
  assert.equal(guestRequests, 1)
})

test('退出账号后迟到的登录响应不会恢复已退出的会话', async context => {
  const store = setup(context)
  const loggingIn = deferredResponse()
  context.mock.method(globalThis, 'fetch', () => loggingIn.promise)
  const pending = store.login('host-account', 'fixture-password')
  store.logout()
  loggingIn.resolve(response(hostLogin))
  assert.equal(await pending, null)
  assert.equal(store.isLoggedIn, false)
  assert.equal(getAccessToken(), '')
})

test('登录进行中进入受保护页面会等待该账号，不会并发签发游客', async context => {
  const store = setup(context)
  const loggingIn = deferredResponse()
  const urls: string[] = []
  context.mock.method(globalThis, 'fetch', (url: string) => { urls.push(url); return loggingIn.promise })
  const login = store.login('host-account', 'fixture-password')
  const enteringMap = store.ensureGuestSession()
  loggingIn.resolve(response(hostLogin))
  await login
  assert.equal(await enteringMap, true)
  assert.equal(urls.length, 1)
  assert.ok(urls[0].endsWith('/Login'))
  assert.equal(store.isAccountLoggedIn, true)
})

test('旧会话续期成功迟到时不能替换新账号的令牌', async context => {
  const store = setup(context)
  const refreshing = deferredResponse()
  context.mock.method(globalThis, 'fetch', async (url: string) => {
    if (url.endsWith('/GuestLogin')) return response(guestLogin)
    if (url.endsWith('/RefreshToken')) return refreshing.promise
    return response(hostLogin)
  })
  await store.loginAsGuest()
  const refresh = store.refreshTokenIfNeeded(true)
  await store.login('host-account', 'fixture-password')
  refreshing.resolve(response({ ...guestLogin, accessToken: 'old-refreshed-token' }))
  assert.equal(await refresh, null)
  assert.equal(store.isAccountLoggedIn, true)
  assert.equal(getAccessToken(), hostLogin.accessToken)
})

test('当前游客会话续期失败时仍能自动恢复游客游览', async context => {
  const store = setup(context)
  let guestRequests = 0
  context.mock.method(globalThis, 'fetch', async (url: string) => {
    if (url.endsWith('/GuestLogin')) { guestRequests++; return response(guestLogin) }
    return Response.json({ code: 10002, message: '续期失败' }, { status: 401 })
  })
  await store.loginAsGuest()
  store.expiresAt = 1
  assert.equal(await store.ensureGuestSession(), true)
  assert.equal(store.isGuest, true)
  assert.equal(guestRequests, 2)
})

test('并发的启动和路由检查共享游客请求，后续复用正式账号令牌', async context => {
  const store = setup(context)
  const guest = deferredResponse()
  let guestRequests = 0
  context.mock.method(globalThis, 'fetch', async (url: string) => {
    if (url.endsWith('/GuestLogin')) { guestRequests++; return guest.promise }
    return response(hostLogin)
  })
  const bootstrap = store.ensureGuestSession()
  const guard = store.ensureGuestSession()
  guest.resolve(response(guestLogin))
  assert.deepEqual(await Promise.all([bootstrap, guard]), [true, true])
  assert.equal(guestRequests, 1)
  await store.login('host-account', 'fixture-password')
  assert.equal(await store.ensureGuestSession(), true)
  assert.equal(store.isAccountLoggedIn, true)
  assert.equal(guestRequests, 1)
})
