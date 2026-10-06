import type { CollectionSearchTask } from '~~/app/types/collection-import';
import { callBackendApi } from '~~/server/utils/collection-import';

/**
 * 批量提交 AI 联网检索任务。
 * 后端契约：ICollectionSearchService.SubmitBatchAsync（CreateBatchCollectionSearchRequest）。
 * 单批上限由后端配置控制。
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<{ items?: unknown }>(event);
  const items = Array.isArray(body?.items) ? body.items : [];

  if (!items.length) {
    throw createError({ statusCode: 400, message: '批量检索至少需要一条任务。' });
  }

  return callBackendApi<CollectionSearchTask[]>(event, '/CollectionSearch/submit-batch', {
    method: 'POST',
    body: { items },
  });
});
