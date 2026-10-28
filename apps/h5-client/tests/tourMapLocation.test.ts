import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createRenderer, h, nextTick, shallowRef } from 'vue'

const require = createRequire(import.meta.url)
const { parse, compileScript } = require('vue/compiler-sfc')
const { build } = createRequire(require.resolve('vite'))('esbuild')
const project = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const temporary = await mkdtemp(resolve(project, 'tests/.tour-map-'))
after(async () => { await rm(temporary, { recursive: true, force: true }) })
const source = await readFile(resolve(project, 'src/components/tour/TourMap.vue'), 'utf8')
await build({
  stdin: { contents: compileScript(parse(source).descriptor, { id: 'tour-map-location-test' }).content, resolveDir: project, loader: 'ts' },
  bundle: true, platform: 'node', format: 'esm', outfile: resolve(temporary, 'map.mjs'), external: ['vue'],
  alias: { '@path-seeker/ts-shared': resolve(project, '../../packages/ts-shared/src/index.ts') },
  plugins: [{ name: 'map-location-fixture', setup(builder: any) {
    builder.onResolve({ filter: /^@\/(services\/amap|composables\/useBrowserLocation)$/ }, () => ({ path: 'map', namespace: 'fixture' }))
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: `
      export const loadAMap = async () => globalThis.tourMapSdk;
      export const transformWgs84ToGcj02 = (longitude, latitude) => ({ longitude: longitude + 0.01, latitude: latitude + 0.01 });
    ` }))
  } }],
})
const { default: TourMap } = await import(pathToFileURL(resolve(temporary, 'map.mjs')).href)

test('本人位置点独立显示，定位更新只移动标记，关闭定位后移除且重新开启时居中', async () => {
  const previousDocument = globalThis.document
  const previousElement = globalThis.HTMLElement
  const markers: any[] = [], removed: unknown[] = [], centers: number[][] = []
  class Element {
    className = ''
    textContent = ''
    attributes: Record<string, string> = {}
    children: Element[] = []
    setAttribute(key: string, value: string) { this.attributes[key] = value }
    append(...children: Element[]) { this.children.push(...children) }
    querySelector(selector: string) { return this.children.find(child => `.${child.className}` === selector) }
  }
  class Marker {
    options: any
    position: number[]
    constructor(options: any) { this.options = options; this.position = options.position; markers.push(this) }
    setPosition(position: number[]) { this.position = position }
    getContent() { return this.options.content }
  }
  class Map {
    add() {}
    remove(target: unknown) { removed.push(target) }
    setPitch() {}
    setCenter(position: number[]) { centers.push(position) }
    destroy() {}
  }
  Object.assign(globalThis, { document: { createElement: () => new Element() }, HTMLElement: Element, tourMapSdk: { Map, Marker } })
  const location = shallowRef<any>(null), label = shallowRef('我的位置')
  const renderer = createRenderer({
    createElement: () => ({}), insert() {}, remove() {}, createText: () => ({}), createComment: () => ({}),
    setText() {}, setElementText() {}, parentNode: () => null, nextSibling: () => null, patchProp() {},
  })
  const MapComponent = { ...TourMap, render() { return h('div', { ref: 'container' }) } }
  const app = renderer.createApp({ setup: () => () => h(MapComponent, {
    catalog: null, detail: null, currentStopId: null, journey: true, location: location.value, locationLabel: label.value, showRoute: true,
  }) })
  app.mount({})
  try {
    await nextTick()
    location.value = { longitude: 116.38, latitude: 39.94 }
    await nextTick()
    assert.equal(markers.length, 1)
    assert.ok(Math.abs(markers[0].position[0] - 116.39) < 1e-9)
    assert.ok(Math.abs(markers[0].position[1] - 39.95) < 1e-9)
    assert.equal(markers[0].options.content.attributes['aria-label'], '我的位置')
    assert.equal(centers.length, 1)
    location.value = { longitude: 116.4, latitude: 39.96 }
    await nextTick()
    assert.equal(markers.length, 1)
    assert.ok(Math.abs(markers[0].position[0] - 116.41) < 1e-9)
    assert.equal(centers.length, 1)
    label.value = 'Your location'
    await nextTick()
    assert.equal(markers[0].options.content.querySelector('.tour-map-location-label').textContent, 'Your location')
    location.value = null
    await nextTick()
    assert.ok(removed.includes(markers[0]))
    location.value = { longitude: 116.38, latitude: 39.94 }
    await nextTick()
    assert.equal(markers.length, 2)
    assert.equal(centers.length, 2)
  } finally {
    app.unmount()
    Object.assign(globalThis, { document: previousDocument, HTMLElement: previousElement })
    Reflect.deleteProperty(globalThis, 'tourMapSdk')
  }
})
