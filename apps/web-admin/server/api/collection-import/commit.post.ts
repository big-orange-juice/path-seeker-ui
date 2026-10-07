import type { CollectionImportSubmitResult, SubmitCollectionImportPayload } from '~~/app/types/collection-import';
import { callBackendApi, readCollectionImportRouteIds } from '~~/server/utils/collection-import';

/**
 * 提交入库：只写入已确认条目（对象级覆盖），未确认的行不写入。
 * 后端契约：ICollectionImportService.SubmitAsync（SubmitCollectionImportRequest）。
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<SubmitCollectionImportPayload>(event);
  const { batchId, candidateIds, version } = readCollectionImportRouteIds(body);

  return callBackendApi<CollectionImportSubmitResult>(event, '/CollectionImport/submit', {
    method: 'POST',
    body: {
      batchId,
      version,
      candidateIds: candidateIds.length ? candidateIds : null,
      runAsync: body.runAsync === true,
    },
  });
});
