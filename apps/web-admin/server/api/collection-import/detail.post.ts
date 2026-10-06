import type { CollectionImportBatchDetail } from '~~/app/types/collection-import';
import { callBackendApi, readCollectionImportRouteIds } from '~~/server/utils/collection-import';

/**
 * 批次详情（含原始资料、候选统计与错误报告地址）。
 * 后端契约：ICollectionImportService.GetBatchAsync(batchId)。
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<{ batchId?: unknown }>(event);
  const { batchId } = readCollectionImportRouteIds(body);

  return callBackendApi<CollectionImportBatchDetail>(event, '/CollectionImport/batch/detail', {
    method: 'GET',
    query: { batchId },
  });
});
