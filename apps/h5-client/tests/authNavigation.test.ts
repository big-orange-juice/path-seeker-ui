import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createRenderer, nextTick } from 'vue'

const require = createRequire(import.meta.url)
const { parse, compileScript } = require('vue/compiler-sfc')
const { build } = createRequire(require.resolve('vite'))('esbuild')
const project = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const temporary = await mkdtemp(resolve(project, 'tests/.auth-navigation-'))
after(async () => { await rm(temporary, { recursive: true, force: true }) })
const source = await readFile(resolve(project, 'src/pages/AuthPage.vue'), 'utf8')
const compiled = compileScript(parse(source).descriptor, { id: 'auth-navigation-test' }).content
await build({
  stdin: { contents: compiled, resolveDir: project, loader: 'ts' },
  bundle: true, platform: 'node', format: 'esm', outfile: resolve(temporary, 'auth.mjs'),
  external: ['vue'],
  plugins: [{ name: 'auth-navigation-fixture', setup(builder: any) {
    builder.onResolve({ filter: /^(vue-router|@path-seeker\/client-state|@\/components\/ui|@\/stores\/useAuthStore)$/ }, () => ({ path: 'fixture', namespace: 'fixture' }))
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: `
      import { reactive } from 'vue';
      export const fixture = globalThis.authNavigationFixture;
      export const useRoute = () => fixture.route;
      export const useRouter = () => fixture.router;
      export const useAuthStore = () => fixture.auth;
      export const useToastStore = () => ({ success() {}, info() {} });
      export const ClientButton = {}, ClientEmptyState = {}, ClientInput = {};
    ` }))
  } }],
})

function deferred() {
  let complete!: (value?: unknown) => void
  const promise = new Promise(resolvePromise => { complete = resolvePromise })
  return { promise, complete }
}

const renderer = createRenderer({
  createElement: () => ({}), insert: () => {}, remove: () => {}, createText: () => ({}),
  createComment: () => ({}), setText: () => {}, setElementText: () => {}, parentNode: () => null,
  nextSibling: () => null, patchProp: () => {},
})

let instance = 0
async function mount(redirect?: unknown) {
  const calls: { kind: string; path?: string }[] = []
  const fixture = {
    route: { query: { redirect } },
    router: {
      replace(path: string) { calls.push({ kind: 'replace', path }); return Promise.resolve() },
      back() { calls.push({ kind: 'back' }) },
    },
    auth: { isAccountLoggedIn: false, pending: false, async login() { return true } },
  }
  Object.assign(globalThis, { authNavigationFixture: fixture, window: { history: { length: 10 } } })
  const { default: AuthPage } = await import(`${pathToFileURL(resolve(temporary, 'auth.mjs')).href}?instance=${++instance}`)
  const app = renderer.createApp({ ...AuthPage, render: () => null })
  app.mount({})
  const state = (app as any)._instance.setupState
  state.loginForm.account = 'fixture-account'
  state.loginForm.password = 'fixture-password'
  return { app, state, fixture, calls }
}

test('登录页返回使用明确的业务地址，保留房间码且不回退到历史登录页', async context => {
  const target = '/translation-room?roomCode=12345678'
  const page = await mount(target)
  context.after(() => page.app.unmount())
  await page.state.goBack()
  assert.deepEqual(page.calls, [{ kind: 'replace', path: target }])
})

test('直接打开登录页或无效返回地址时统一回到路线入口', async () => {
  for (const redirect of [undefined, '/auth?redirect=/ride', '//other.test', 'https://other.test']) {
    const page = await mount(redirect)
    try {
      await page.state.goBack()
      assert.deepEqual(page.calls, [{ kind: 'replace', path: '/ride' }])
    } finally { page.app.unmount() }
  }
})

test('登录成功等待导航期间保持提交状态，不闪出账号页也不重复登录', async context => {
  const page = await mount('/shell/archive?tab=completed')
  context.after(() => page.app.unmount())
  const navigating = deferred()
  let logins = 0
  page.fixture.auth.login = async () => { logins++; page.fixture.auth.isAccountLoggedIn = true; return true }
  page.fixture.router.replace = (path: string) => { page.calls.push({ kind: 'replace', path }); return navigating.promise as Promise<void> }
  const submitting = page.state.submitCurrentMode()
  await nextTick()
  assert.equal(page.state.submitting, true)
  assert.equal(page.state.showAccount, false)
  assert.equal(page.state.canSubmitCurrent, false)
  await page.state.submitCurrentMode()
  assert.equal(logins, 1)
  assert.deepEqual(page.calls, [{ kind: 'replace', path: '/shell/archive?tab=completed' }])
  navigating.complete()
  await submitting
})

test('登录请求未完成时离开页面，迟到的成功响应不会把用户拉回原页面', async () => {
  const page = await mount('/translation-room')
  const login = deferred()
  page.fixture.auth.login = async () => { await login.promise; return true }
  const submitting = page.state.submitCurrentMode()
  page.app.unmount()
  login.complete()
  await submitting
  assert.deepEqual(page.calls, [])
})
