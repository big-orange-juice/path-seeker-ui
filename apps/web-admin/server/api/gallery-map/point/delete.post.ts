import type { ApiResponse } from '~~/app/types/api';
import type { DeleteGalleryMapPointRequest } from '~~/app/types/gallery-map';
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend';

export default defineEventHandler(async (event) => {
  const body = await readBody<DeleteGalleryMapPointRequest>(event);
  const id = String(body?.id || '').trim();
  if (!id) {
    throw createError({ statusCode: 400, message: '点位 ID 不能为空。' });
  }

  const response = await backendFetch<ApiResponse>(event, '/GalleryMap/DeletePoint', {
    method: 'POST',
    body: { id },
  });

  return unwrapApiResponse(response);
});
