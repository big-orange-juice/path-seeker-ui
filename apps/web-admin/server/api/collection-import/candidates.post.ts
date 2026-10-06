import { COLLECTION_IMPORT_PAGE_SIZE } from '~~/app/types/collection-import';
import type {
  CollectionImportCandidate,
  CollectionImportCandidatePagePayload,
  TotalPageResult,
} from '~~/app/types/collection-import';
import { callBackendApi, readCollectionImportRouteIds } from '~~/server/utils/collection-import';

/**
 * 候选条目分页预览（每页默认 200 行，见设计文档 §2.3 第 8 条）。
 * 后端契约：ICollectionImportService.PageCandidatesAsync（CollectionImportCandidatePageRequest）。
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<CollectionImportCandidatePagePayload>(event);
  const { batchId } = readCollectionImportRouteIds(body);

  const pageIndex = Number.isFinite(Number(body?.pageIndex)) && Number(body?.pageIndex) > 0
    ? Number(body.pageIndex)
    : 1;
  const pageSize = Number.isFinite(Number(body?.pageSize)) && Number(body?.pageSize) > 0
    ? Number(body.pageSize)
    : COLLECTION_IMPORT_PAGE_SIZE;

  return callBackendApi<TotalPageResult<CollectionImportCandidate[]>>(
    event,
    '/CollectionImport/candidate/page',
    {
      method: 'POST',
      body: {
        batchId,
        pageIndex,
        pageSize,
        status: typeof body?.status === 'number' ? body.status : null,
        targetType: typeof body?.targetType === 'number' ? body.targetType : null,
      },
    },
  );
});
