/**
 * 渲染器共享契约和基础 renderer 的统一出口。
 *
 * 这里既导出题型协议，也导出可在小程序和后台预览里复用的基础组件。
 */
export * from "./contracts"
export { default as PuzzleRendererHost } from "./components/PuzzleRendererHost.vue"
export * from "./components/renderers"
