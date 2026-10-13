import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'

const require = createRequire(new URL('../package.json', import.meta.url))
const typescript = require('typescript')
const vue = createRequire(require.resolve('nuxt/package.json'))('vue')

function fixture(request) {
  const source = readFileSync(new URL('../app/composables/useRickshawManagement.ts', import.meta.url), 'utf8')
  const compiled = typescript.transpileModule(source, {
    compilerOptions: { module: typescript.ModuleKind.CommonJS, target: typescript.ScriptTarget.ES2022 },
  })
  const exports = {}
  const resolve = name => name === 'vue' ? vue : {
    useApiClient: () => ({ request }), resolveApiErrorMessage: error => error.message,
  }
  new Function('require', 'exports', compiled.outputText)(resolve, exports)
  return exports.useRickshawManagement()
}

test('concurrent creates send one request, preserve string IDs and disable automatic retries', async () => {
  let release
  const calls = []
  const model = fixture((path, options) => {
    calls.push({ path, options })
    return new Promise(resolve => { release = resolve })
  })
  const draft = { museumId: '9007199254740993', vehicleNo: ' 001 ', driverName: '', remark: '' }
  const first = model.save(draft)
  await assert.rejects(model.save(draft), /等待/)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].options.body.museumId, draft.museumId)
  assert.equal(calls[0].options.body.vehicleNo, '001')
  assert.equal(calls[0].options.retry, 0)
  assert.equal(model.acting.value, true)
  release('9007199254740995')
  assert.equal(await first, '9007199254740995')
  assert.equal(model.acting.value, false)
})

test('failed operations unlock so that a corrected request can proceed', async () => {
  let calls = 0
  const model = fixture(async () => {
    calls += 1
    if (calls === 1) throw new Error('车号已存在')
    return null
  })
  await assert.rejects(model.updateStatus('9007199254740993', 2), /车号/)
  assert.equal(model.acting.value, false)
  await model.updateStatus('9007199254740993', 1)
  assert.equal(calls, 2)
})

test('getting QR repeatedly does not rotate printed codes; rotation is explicit', async () => {
  const bodies = []
  const model = fixture(async (_, options) => { bodies.push(options.body); return { token: 'stable' } })
  await model.generateQr('9007199254740993')
  await model.generateQr('9007199254740993')
  await model.generateQr('9007199254740993', true)
  assert.deepEqual(bodies.map(body => body.rotate), [false, false, true])
  assert.ok(bodies.every(body => body.id === '9007199254740993'))
})

test('out-of-order query responses cannot overwrite the latest filter results', async () => {
  const requests = []
  const model = fixture((_, options) => new Promise(resolve => { requests.push({ options, resolve }) }))
  model.keyword.value = '旧'
  const first = model.refresh(1)
  model.keyword.value = '新'
  const second = model.refresh(2)
  requests[1].resolve({ list: [{ id: 'new' }], total: 21, pageIndex: 2, pageSize: 20 })
  await second
  requests[0].resolve({ list: [{ id: 'old' }], total: 1, pageIndex: 1, pageSize: 20 })
  await first
  assert.equal(model.rows.value[0].id, 'new')
  assert.equal(model.pageIndex.value, 2)
  assert.equal(model.totalPages.value, 2)
  assert.equal(model.pending.value, false)
})

test('query errors keep the existing list and allow retry', async () => {
  let fail = false
  const model = fixture(async () => {
    if (fail) throw new Error('请求超时')
    return { list: [{ id: 'stable' }], total: 1, pageIndex: 1, pageSize: 20 }
  })
  await model.refresh()
  fail = true
  await model.refresh()
  assert.equal(model.rows.value[0].id, 'stable')
  assert.equal(model.error.value, '请求超时')
  assert.equal(model.pending.value, false)
  fail = false
  await model.refresh()
  assert.equal(model.error.value, '')
})
