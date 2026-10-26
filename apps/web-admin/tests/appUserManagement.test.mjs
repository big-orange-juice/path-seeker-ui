import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'

const require = createRequire(new URL('../package.json', import.meta.url))
const typescript = require('typescript')
const vue = createRequire(require.resolve('nuxt/package.json'))('vue')

function fixture(request) {
  const source = readFileSync(new URL('../app/composables/useAppUserManagement.ts', import.meta.url), 'utf8')
  const compiled = typescript.transpileModule(source, {
    compilerOptions: { module: typescript.ModuleKind.CommonJS, target: typescript.ScriptTarget.ES2022 },
  })
  const exports = {}
  const resolve = name => name === 'vue' ? vue : {
    useApiClient: () => ({ request }), resolveApiErrorMessage: error => error.message,
  }
  new Function('require', 'exports', compiled.outputText)(resolve, exports)
  return exports.useAppUserManagement()
}

test('driver grants preserve large string IDs and phone; revoking sends no phone', async () => {
  const calls = []
  const model = fixture(async (path, options) => { calls.push({ path, options }) })
  await model.saveDriver({ userId: '9223372036854775806', isDriver: true, phone: ' 13800138000 ' })
  await model.saveDriver({ userId: '9223372036854775806', isDriver: false, phone: '13800138000' })
  assert.deepEqual(calls.map(call => call.options.body), [
    { userId: '9223372036854775806', isDriver: true, phone: '13800138000' },
    { userId: '9223372036854775806', isDriver: false, phone: null },
  ])
  assert.ok(calls.every(call => call.options.retry === 0))
})

test('failed grants can be retried and concurrent grants are blocked', async () => {
  let rejectRequest
  const model = fixture(() => new Promise((_, reject) => { rejectRequest = reject }))
  const draft = { userId: '9223372036854775806', isDriver: true, phone: '13800138000' }
  const pending = model.saveDriver(draft)
  await assert.rejects(model.saveDriver(draft), /等待/)
  rejectRequest(new Error('手机号已关联其他账号'))
  await assert.rejects(pending, /手机号/)
  assert.equal(model.saving.value, false)
})

test('queries keep false driver filter and stale results cannot overwrite the latest query', async () => {
  const requests = []
  const model = fixture((_, options) => new Promise(resolve => { requests.push({ options, resolve }) }))
  model.keyword.value = ' 13800138000 '
  model.isDriver.value = 'false'
  const first = model.refresh()
  model.isDriver.value = 'true'
  const second = model.refresh(2)
  assert.equal(requests[0].options.body.isDriver, false)
  assert.equal(requests[0].options.body.keyword, '13800138000')
  requests[1].resolve({ list: [{ id: 'latest' }], total: 21, pageIndex: 2 })
  await second
  requests[0].resolve({ list: [{ id: 'stale' }], total: 1, pageIndex: 1 })
  await first
  assert.equal(model.rows.value[0].id, 'latest')
  assert.equal(model.pageIndex.value, 2)
  assert.equal(model.pending.value, false)
})
