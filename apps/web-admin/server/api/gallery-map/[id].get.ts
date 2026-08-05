import type { ApiResponse } from '~~/app/types/api';
import type { GalleryMapResponse } from '~~/app/types/gallery-map';
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend';

export default defineEventHandler(async (event) => {
  const id = String(getRouterParam(event, 'id') || '').trim();
  if (!id) {
    throw createError({ statusCode: 400, message: '地图 ID 不能为空。' });
  }

  const response = await backendFetch<ApiResponse<GalleryMapResponse>>(event, '/GalleryMap/Get', {
    query: { id },
  });

  return unwrapApiResponse(response);
});
