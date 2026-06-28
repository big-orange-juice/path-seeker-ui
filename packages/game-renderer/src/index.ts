/**
 * 渲染器共享契约的统一出口。
 *
 * 这里只导出题型协议，不导出真实运行时代码。等 mini-app 和后台预览
 * 都确实需要共享可执行 renderer 时，再把实现抽到这个包里。
 */
export * from "./contracts"
