import type { ApiResponse } from '~~/app/types/api';
import type { ReorderExtraAudioRequest } from '~~/app/types/narration-extra-audio';
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend';

/** 组内重排。对应后端 POST /api/NarrationExtraAudio/reorder */
export default defineEventHandler(async (event) => {
  const body = await readBody<ReorderExtraAudioRequest>(event);
  if (!body?.stageId?.trim()) throw createError({ statusCode: 400, message: '节点 ID 不能为空。' });
  if (body.position !== 'before' && body.position !== 'after') {
    throw createError({ statusCode: 400, message: '播放位置只支持 before(讲解前) 或 after(讲解后)。' });
  }
  if (!Array.isArray(body.items) || !body.items.length || body.items.some(item => !item?.id?.trim())) {
    throw createError({ statusCode: 400, message: '排序列表不能为空。' });
  }

  return unwrapApiResponse(
    await backendFetch<ApiResponse>(event, '/NarrationExtraAudio/reorder', { method: 'POST', body }),
  );
});
