/**
 * AI 生成解说配图（异步）— 当前编辑 UI 暂不开放。
 *
 * 后端契约：POST /NarrationImage/generate
 * body: { stageId, prompt, idempotencyKey, modelName?, referenceImageUrls?, ... }
 * 返回: { taskId, stageId, status, ... }，完成后需轮询或刷新 detail.images。
 *
 * 启用时在此代理 backendFetch('/NarrationImage/generate')，
 * 并在 StageEditDialog 恢复「AI 生成」入口。
 */
export default defineEventHandler(async () => {
  throw createError({
    statusCode: 501,
    message: 'AI 配图生成暂未开放。',
  })
})
