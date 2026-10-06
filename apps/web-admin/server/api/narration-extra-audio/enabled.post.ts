import type { ApiResponse } from '~~/app/types/api';
import type { SetExtraAudioEnabledRequest } from '~~/app/types/narration-extra-audio';
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend';

/** 启用或停用单条额外音频。对应后端 POST /api/NarrationExtraAudio/enabled */
export default defineEventHandler(async (event) => {
  const body = await readBody<SetExtraAudioEnabledRequest>(event);
  if (!body?.id?.trim()) throw createError({ statusCode: 400, message: '音频 ID 不能为空。' });
  if (body.enabled !== 0 && body.enabled !== 1) {
    throw createError({ statusCode: 400, message: '启用状态只支持 1(启用) 或 0(停用)。' });
  }

  return unwrapApiResponse(
    await backendFetch<ApiResponse>(event, '/NarrationExtraAudio/enabled', { method: 'POST', body }),
  );
});
