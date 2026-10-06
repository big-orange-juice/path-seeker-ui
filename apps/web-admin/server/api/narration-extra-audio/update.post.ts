import type { ApiResponse } from '~~/app/types/api';
import type { UpdateExtraAudioRequest } from '~~/app/types/narration-extra-audio';
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend';

/**
 * 更新单条额外音频（表单式，只提交需要改动的字段）。
 * `titleSpecified = true` 才允许清空标题；`version` 不一致时后端返回 10005 冲突。
 * 对应后端 POST /api/NarrationExtraAudio/update
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<UpdateExtraAudioRequest>(event);
  if (!body?.id?.trim()) throw createError({ statusCode: 400, message: '音频 ID 不能为空。' });

  return unwrapApiResponse(
    await backendFetch<ApiResponse>(event, '/NarrationExtraAudio/update', { method: 'POST', body }),
  );
});
