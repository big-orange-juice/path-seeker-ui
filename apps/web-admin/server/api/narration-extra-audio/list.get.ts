import type { ApiResponse } from '~~/app/types/api';
import type { ExtraAudioGroupResponse } from '~~/app/types/narration-extra-audio';
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend';

/** 按节点读取额外音频（讲解前/讲解后分组）。对应后端 GET /api/NarrationExtraAudio/list */
export default defineEventHandler(async (event) => {
  const stageId = String(getQuery(event).stageId || '').trim();
  if (!stageId || stageId === '0') throw createError({ statusCode: 400, message: '节点 ID 不能为空。' });

  return unwrapApiResponse(
    await backendFetch<ApiResponse<ExtraAudioGroupResponse>>(event, '/NarrationExtraAudio/list', {
      query: { stageId },
    }),
  );
});
