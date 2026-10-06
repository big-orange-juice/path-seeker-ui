import type { CollectionImportParseResult, ParseCollectionImportPayload } from '~~/app/types/collection-import';
import { callBackendApi } from '~~/server/utils/collection-import';

/**
 * 上传并解析导入文件。
 *
 * 后端契约：ICollectionImportService.ParseAsync（ParseCollectionImportRequest）。
 * 请求字段是 batchId + attachmentId —— 文件本身先走既有 /api/uploads/file 上传，
 * 因此不存在单独的"上传并解析"多段接口，前端先取 attachmentId 再调用本接口。
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<ParseCollectionImportPayload>(event);
  const batchId = String(body?.batchId ?? '').trim();
  const attachmentId = String(body?.attachmentId ?? '').trim();

  if (!batchId) {
    throw createError({ statusCode: 400, message: '缺少批次 ID（batchId）。' });
  }

  if (!attachmentId) {
    throw createError({ statusCode: 400, message: '缺少已上传文件的附件 ID（attachmentId）。' });
  }

  return callBackendApi<CollectionImportParseResult>(event, '/CollectionImport/parse', {
    method: 'POST',
    body: { batchId, attachmentId },
  });
});
