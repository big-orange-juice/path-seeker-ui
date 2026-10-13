import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'

const require = createRequire(new URL('../package.json', import.meta.url))
const typescript = require('typescript')
const vue = createRequire(require.resolve('nuxt/package.json'))('vue')

function fixture(request) {
  const props = vue.reactive({ routeId: '9007199254740993', canEdit: true, nodes: [
    { stageId: '9007199254740995', stageNo: 1 }, { stageId: '9007199254740997', stageNo: 2 },
  ], selectedStageId: '' })
  const events = []
  const scope = vue.effectScope()
  const source = readFileSync(new URL('../app/components/routes/OutdoorRouteWorkspace.vue', import.meta.url), 'utf8')
    .split('<script setup lang="ts">')[1].split('</script>')[0]
  const compiled = typescript.transpileModule(`${source}\nexport { save, reorder, detail, pending }`, {
    compilerOptions: { module: typescript.ModuleKind.CommonJS, target: typescript.ScriptTarget.ES2022 },
  })
  const exports = {}
  scope.run(() => {
    new Function('require', 'exports', 'defineProps', 'defineEmits', 'defineExpose', 'useApiClient', compiled.outputText)(
      name => name === 'vue' ? { ...vue, onBeforeUnmount: () => {} } : {}, exports,
      () => props, () => (...args) => events.push(args), () => {}, () => ({ request }),
    )
  })
  return { ...exports, props, events, stop: () => scope.stop() }
}

test('switching routes during reorder keeps both writes on the original route', async () => {
  const calls = []
  let release
  const model = fixture(async (path, options) => {
    if (path.endsWith('/get')) return { routeId: options.query.routeId, stations: [], segments: [] }
    calls.push({ path, options })
    if (path.endsWith('/stage-reorder')) await new Promise(resolve => { release = resolve })
    return { routeId: options.body.routeId, stations: [], segments: [] }
  })
  await vue.nextTick()
  const changing = model.reorder(0, 1)
  model.props.routeId = '9007199254740999'
  await vue.nextTick()
  release()
  await changing
  assert.equal(calls.length, 2)
  assert.ok(calls.every(call => call.options.body.routeId === '9007199254740993'))
  assert.ok(calls.every(call => call.options.retry === 0 && call.options.timeout > 0))
  assert.equal(model.detail.value.routeId, '9007199254740999')
  assert.equal(model.pending.value, false)
  model.stop()
})

test('late compilation save cannot overwrite the newly selected route', async () => {
  let release
  const model = fixture(async (path, options) => {
    if (path.endsWith('/get')) return { routeId: options.query.routeId, stations: [], segments: [] }
    return await new Promise(resolve => { release = () => resolve({ routeId: options.body.routeId, stations: [], segments: [] }) })
  })
  await vue.nextTick()
  const saving = model.save()
  model.props.routeId = 'new-route'
  await vue.nextTick()
  release()
  assert.equal(await saving, false)
  assert.equal(model.detail.value.routeId, 'new-route')
  assert.equal(model.pending.value, false)
  model.stop()
})

test('failed sync after successful reorder reports the saved order once and releases the lock', async () => {
  let writes = 0
  const model = fixture(async (path, options) => {
    if (path.endsWith('/get')) return { routeId: options.query.routeId, stations: [], segments: [] }
    writes += 1
    if (path.endsWith('/sync-stations')) throw new Error('同步失败')
    return null
  })
  await vue.nextTick()
  await model.reorder(0, 1)
  assert.equal(writes, 2)
  assert.equal(model.events.filter(event => event[0] === 'changed').length, 1)
  assert.equal(model.pending.value, false)
  model.stop()
})
