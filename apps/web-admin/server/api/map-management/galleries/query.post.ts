import type { ApiResponse } from '~~/app/types/api';
import type { GalleryPageRequest, GalleryResponse, GalleryResponseListTotalPageResult } from '~~/app/types/museum';
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend';

export default defineEventHandler(async (event) => {
  const body = await readBody<GalleryPageRequest>(event);
  const response = await backendFetch<ApiResponse<GalleryResponseListTotalPageResult<GalleryResponse>>>(event, '/api/Gallery/PageList', {
    method: 'POST',
    body,
  });

  return unwrapApiResponse(response) ?? {
    list: [],
    pageIndex: body.pageIndex || 1,
    pageSize: body.pageSize || 1000,
    total: 0,
    totalPages: 0,
  };
});
