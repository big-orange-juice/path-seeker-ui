import type { ApiResponse } from '~~/app/types/api';
import type { GalleryMapPointResponse } from '~~/app/types/gallery-map';
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend';

export default defineEventHandler(async (event) => {
  const id = String(getRouterParam(event, 'id') || '').trim();
  if (!id) {
    throw createError({ statusCode: 400, message: '点位 ID 不能为空。' });
  }

  const response = await backendFetch<ApiResponse<GalleryMapPointResponse>>(event, '/GalleryMap/GetPoint', {
    query: { id },
  });

  return unwrapApiResponse(response);
});
