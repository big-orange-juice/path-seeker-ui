import type { SkipCollectionImportCandidatesPayload } from '~~/app/types/collection-import';
import { callBackendApi, readCollectionImportRouteIds } from '~~/server/utils/collection-import';

/**
 * 逐条或批量跳过候选条目。
 * 后端契约：ICollectionImportService.SkipCandidatesAsync（SkipCollectionImportCandidatesRequest）。
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<SkipCollectionImportCandidatesPayload>(event);
  const { batchId, candidateIds } = readCollectionImportRouteIds(body);

  if (!candidateIds.length) {
    throw createError({ statusCode: 400, message: '请至少选择一条候选条目。' });
  }

  return callBackendApi<number>(event, '/CollectionImport/candidate/skip', {
    method: 'POST',
    body: { batchId, candidateIds },
  });
});
