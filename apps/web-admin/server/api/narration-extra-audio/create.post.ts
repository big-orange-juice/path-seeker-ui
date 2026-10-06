import type { ApiResponse } from '~~/app/types/api';
import type { CreateExtraAudioRequest } from '~~/app/types/narration-extra-audio';
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend';

/** 新增一条额外音频，返回记录 ID 字符串。对应后端 POST /api/NarrationExtraAudio/create */
export default defineEventHandler(async (event) => {
  const body = await readBody<CreateExtraAudioRequest>(event);
  if (!body?.stageId?.trim() || !body?.attachmentId?.trim()) {
    throw createError({ statusCode: 400, message: '节点和音频附件不能为空。' });
  }

  return unwrapApiResponse(
    await backendFetch<ApiResponse<string>>(event, '/NarrationExtraAudio/create', { method: 'POST', body }),
  );
});
