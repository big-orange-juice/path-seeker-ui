import type { CollectionImportBatch, CreateCollectionImportBatchPayload } from '~~/app/types/collection-import';
import { callBackendApi } from '~~/server/utils/collection-import';

/**
 * 创建导入批次。
 * 后端契约：ICollectionImportService.CreateBatchAsync（CreateCollectionImportBatchRequest）。
 * WebApi 里尚未有 CollectionImportController；接口不存在时由工具函数转成
 * 501 + data.reason='backend_endpoint_missing'，页面据此给出明确提示。
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<CreateCollectionImportBatchPayload>(event);
  const museumId = String(body?.museumId ?? '').trim();
  const idempotencyKey = String(body?.idempotencyKey ?? '').trim();

  if (!museumId) {
    throw createError({ statusCode: 400, message: '请选择导入的目标场馆/目的地。' });
  }

  if (!idempotencyKey) {
    throw createError({ statusCode: 400, message: '缺少幂等键（idempotencyKey）。' });
  }

  return callBackendApi<CollectionImportBatch>(event, '/CollectionImport/batch/create', {
    method: 'POST',
    body: {
      museumId,
      idempotencyKey,
      sourceKind: typeof body?.sourceKind === 'number' ? body.sourceKind : 1,
      templateVersion: body?.templateVersion ?? null,
    },
  });
});
