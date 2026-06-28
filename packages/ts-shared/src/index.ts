/**
 * 共享前端契约的统一出口。
 *
 * 这个包只暴露稳定、跨应用复用的领域模型和产品词汇。
 * 原始 swagger DTO、分页包装壳、后台强耦合请求参数，不应该进入这一层。
 */
export * from "./core"
export * from "./enums"
export * from "./persona"
export * from "./reward"
export * from "./route"
export * from "./play"
