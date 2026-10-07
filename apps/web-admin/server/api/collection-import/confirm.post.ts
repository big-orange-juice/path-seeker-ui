import type { ConfirmCollectionImportCandidatesPayload } from '~~/app/types/collection-import';
import { callBackendApi, readCollectionImportRouteIds } from '~~/server/utils/collection-import';

/**
 * 逐条或批量确认候选条目（确认即接受对象级覆盖）。
 * 后端契约：ICollectionImportService.ConfirmCandidatesAsync（ConfirmCollectionImportCandidatesRequest）。
 * version 传入时必须与当前批次版本一致，用于防止确认后批次被改写。
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<ConfirmCollectionImportCandidatesPayload>(event);
  const { batchId, candidateIds, version } = readCollectionImportRouteIds(body);

  if (!candidateIds.length) {
    throw createError({ statusCode: 400, message: '请至少选择一条候选条目。' });
  }

  return callBackendApi<number>(event, '/CollectionImport/candidate/confirm', {
    method: 'POST',
    body: {
      batchId,
      candidateIds,
      acceptOverwrite: body?.acceptOverwrite !== false,
      acceptMapping: body?.acceptMapping === true,
      version,
    },
  });
});
