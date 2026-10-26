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
    contents: "export { useAuthStore } from './src/stores/useAuthStore'; export { getAccessToken } from './src/services/authSession'; export { roomRequest } from './src/services/translationRoom';",
    resolveDir: project,
  },
  bundle: true, platform: 'node', format: 'esm', outfile: resolve(temporary, 'authAccount.mjs'),
  external: ['vue', 'pinia'],
  alias: { '@': resolve(project, 'src'), '@path-seeker/ts-shared': resolve(project, '../../packages/ts-shared/src/index.ts') },
  define: { 'import.meta.env.VITE_API_BASE_URL': '"https://fixture.test/api"' },
})
const { useAuthStore, getAccessToken, roomRequest } = await import(pathToFileURL(resolve(temporary, 'authAccount.mjs')).href)

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
