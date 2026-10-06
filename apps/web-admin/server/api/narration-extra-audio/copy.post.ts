import type { ApiResponse } from '~~/app/types/api';
import type { CopyExtraAudioRequest } from '~~/app/types/narration-extra-audio';
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend';

/**
 * 把源节点额外音频复制到目标节点（多语言转换使用，只复制附件关联，不生成目标语言音频）。
 * 返回复制条数。对应后端 POST /api/NarrationExtraAudio/copy
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<CopyExtraAudioRequest>(event);
  if (!body?.sourceStageId?.trim() || !body?.targetStageId?.trim()) {
    throw createError({ statusCode: 400, message: '源节点和目标节点不能为空。' });
  }
  if (body.sourceStageId.trim() === body.targetStageId.trim()) {
    throw createError({ statusCode: 400, message: '目标节点不能与当前节点相同。' });
  }

  return unwrapApiResponse(
    await backendFetch<ApiResponse<number>>(event, '/NarrationExtraAudio/copy', { method: 'POST', body }),
  );
});
