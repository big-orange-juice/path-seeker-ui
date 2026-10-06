import type { ApiResponse } from '~~/app/types/api';
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend';

/** 删除单条额外音频。对应后端 POST /api/NarrationExtraAudio/delete */
export default defineEventHandler(async (event) => {
  const body = await readBody<{ id?: string }>(event);
  const id = String(body?.id || '').trim();
  if (!id) throw createError({ statusCode: 400, message: '音频 ID 不能为空。' });

  return unwrapApiResponse(
    await backendFetch<ApiResponse>(event, '/NarrationExtraAudio/delete', { method: 'POST', body: { id } }),
  );
});
