import type {
  CollectionImportBatch,
  CollectionImportBatchPagePayload,
  TotalPageResult,
} from '~~/app/types/collection-import';
import { callBackendApi } from '~~/server/utils/collection-import';

/**
 * 导入批次分页查询（按 museumId 在查询条件中过滤，禁止先查全量再在内存中裁剪）。
 * 后端契约：ICollectionImportService.PageBatchesAsync（CollectionImportBatchPageRequest）。
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<CollectionImportBatchPagePayload>(event);
  const pageIndex = Number.isFinite(Number(body?.pageIndex)) && Number(body?.pageIndex) > 0
    ? Number(body.pageIndex)
    : 1;
  const pageSize = Number.isFinite(Number(body?.pageSize)) && Number(body?.pageSize) > 0
    ? Number(body.pageSize)
    : 20;

  return callBackendApi<TotalPageResult<CollectionImportBatch[]>>(event, '/CollectionImport/batch/list', {
    method: 'POST',
    body: {
      pageIndex,
      pageSize,
      museumId: body?.museumId ? String(body.museumId) : null,
      status: typeof body?.status === 'number' ? body.status : null,
    },
  });
});
