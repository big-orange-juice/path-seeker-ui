import type { CollectionSearchTask } from '~~/app/types/collection-import';
import { callBackendApi } from '~~/server/utils/collection-import';

/**
 * 查询单个 AI 联网检索任务。
 * 后端契约：ICollectionSearchService.GetTaskAsync(taskId)。
 * 前端据此轮询任务状态，完成后用返回的 batchId 打开候选预览。
 */
export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const taskId = String(query.taskId ?? '').trim();

  if (!taskId) {
    throw createError({ statusCode: 400, message: '缺少任务 ID（taskId）。' });
  }

  return callBackendApi<CollectionSearchTask>(event, '/CollectionSearch/task/detail', {
    method: 'GET',
    query: { taskId },
  });
});
