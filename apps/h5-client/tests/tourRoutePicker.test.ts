import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createRenderer, nextTick } from 'vue'
import { tourMessages } from '../src/utils/tourMessages.ts'

const require = createRequire(import.meta.url)
const { parse, compileScript } = require('vue/compiler-sfc')
const { transpileModule, ModuleKind, ScriptTarget } = require('typescript')
const temporary = await mkdtemp(fileURLToPath(new URL('./.route-picker-', import.meta.url)))
after(async () => { await rm(temporary, { recursive: true, force: true }) })
const source = await readFile(new URL('../src/components/tour/TourRoutePicker.vue', import.meta.url), 'utf8')
const descriptor = parse(source).descriptor
const compiled = compileScript(descriptor, { id: 'route-picker-test' }).content
const filename = `${temporary}/picker.mjs`
await writeFile(filename, transpileModule(compiled, {
  compilerOptions: { module: ModuleKind.ESNext, target: ScriptTarget.ES2022 },
}).outputText)
const { default: RoutePicker } = await import(pathToFileURL(filename).href)

test('搜索隐藏已选路线后不能开始隐藏的行程，清空搜索恢复原选择', async () => {
  const renderer = createRenderer({
    createElement: () => ({}), insert: () => {}, remove: () => {}, createText: () => ({}),
    createComment: () => ({}), setText: () => {}, setElementText: () => {}, parentNode: () => null,
    nextSibling: () => null, patchProp: () => {},
  })
  const routes = [
    { id: '2110170848768954368', title: '后海黄包车长线', guideName: '窦总' },
    { id: '620000000000001001', title: '后海慢游', guideName: '陈老师' },
  ]
  const app = renderer.createApp({ ...RoutePicker, render: () => null }, {
    routes, selectedId: routes[0].id, pending: false, canStart: true, messages: tourMessages('zh'),
  })
  app.mount({})
  const state = (app as any)._instance.setupState
  try {
    await nextTick()
    assert.equal(state.selected.id, routes[0].id)
    state.search = '不存在的路线'
    await nextTick()
    assert.equal(state.filtered.length, 0)
    assert.equal(state.selected, undefined)
    state.search = '陈老师'
    await nextTick()
    assert.equal(state.filtered.length, 1)
    assert.equal(state.filtered[0].id, routes[1].id)
    assert.equal(state.selected, undefined)
    state.search = '  窦总  '
    await nextTick()
    assert.equal(state.selected.id, routes[0].id)
    state.search = ''
    await nextTick()
    assert.equal(state.filtered.length, 2)
    assert.equal(state.selected.id, routes[0].id)
  } finally { app.unmount() }
})
