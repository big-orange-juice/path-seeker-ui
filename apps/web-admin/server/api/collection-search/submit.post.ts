import type {
  CollectionSearchTask,
  CreateCollectionSearchPayload,
} from '~~/app/types/collection-import';
import { callBackendApi } from '~~/server/utils/collection-import';

/**
 * 提交单条 AI 联网检索任务。
 *
 * 后端契约：ICollectionSearchService.SubmitAsync（CreateCollectionSearchRequest）。
 * 检索产物写入与导入同一套 collection_import_candidate 契约，
 * 因此结果继续走 /api/collection-import/{candidates,confirm,skip,commit} 预览与确认。
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<CreateCollectionSearchPayload>(event);
  const museumId = String(body?.museumId ?? '').trim();
  const idempotencyKey = String(body?.idempotencyKey ?? '').trim();
  const targetId = body?.targetId ? String(body.targetId).trim() : '';
  const objectName = body?.objectName ? String(body.objectName).trim() : '';

  if (!museumId) {
    throw createError({ statusCode: 400, message: '缺少目标场馆/目的地 ID（museumId）。' });
  }

  if (!idempotencyKey) {
    throw createError({ statusCode: 400, message: '缺少幂等键（idempotencyKey）。' });
  }

  if (!targetId && !objectName) {
    throw createError({ statusCode: 400, message: '请提供目标对象 ID 或对象名称。' });
  }

  return callBackendApi<CollectionSearchTask>(event, '/CollectionSearch/submit', {
    method: 'POST',
    body: {
      museumId,
      targetType: typeof body?.targetType === 'number' ? body.targetType : 1,
      targetId: targetId || null,
      objectName: objectName || null,
      objectCode: body?.objectCode ? String(body.objectCode).trim() : null,
      fields: Array.isArray(body?.fields) && body.fields.length ? body.fields : null,
      idempotencyKey,
      priority: typeof body?.priority === 'number' ? body.priority : null,
    },
  });
});
