import type {
  CollectionImportCandidate,
  TotalPageResult,
} from '~~/app/types/collection-import';
import { callBackendApi, readCollectionImportRouteIds } from '~~/server/utils/collection-import';

/**
 * 读取批次全部候选条目。
 *
 * 后端契约：ICollectionImportService.ListCandidatesAsync(batchId)。
 * 该接口没有分页参数，AI 联网检索结果也写入同一张候选表，因此检索入口
 * 同样复用本接口（设计文档 §7：检索产物写入导入的同一份候选条目契约）。
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<{ batchId?: unknown }>(event);
  const { batchId } = readCollectionImportRouteIds(body);

  return callBackendApi<CollectionImportCandidate[] | TotalPageResult<CollectionImportCandidate[]>>(
    event,
    '/CollectionImport/candidate/list',
    {
      method: 'GET',
      query: { batchId },
    },
  );
});
