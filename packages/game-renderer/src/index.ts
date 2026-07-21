/**
 * 渲染器共享契约和基础 renderer 的统一出口。
 *
 * 这里既导出题型协议，也导出可在小程序和后台预览里复用的基础组件。
 * stage config → PuzzleDefinition 的唯一映射见 adaptStage。
 */
export * from "./contracts"
export * from "./adaptStage"
export { default as PuzzleRendererHost } from "./components/PuzzleRendererHost.vue"
export { default as StagePlaySurface } from "./components/StagePlaySurface.vue"
export { default as FindScanPlayChain } from "./components/FindScanPlayChain.vue"
export * from "./components/renderers"
