import type { ApiResponse } from '~~/app/types/api';
import type { UploadAttachment } from '~~/app/types/upload';
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend';

export default defineEventHandler(async (event) => {
  const formData = await readFormData(event);
  const file = formData.get('file');

  if (!(file instanceof Blob)) {
    throw createError({
      statusCode: 400,
      message: '缺少上传文件。',
    });
  }

  const nextFormData = new FormData();
  nextFormData.append('file', file, (file as File).name || 'file');

  const response = await backendFetch<ApiResponse<UploadAttachment>>(event, '/Upload/UploadFile', {
    method: 'POST',
    body: nextFormData,
  });

  return unwrapApiResponse(response);
});
