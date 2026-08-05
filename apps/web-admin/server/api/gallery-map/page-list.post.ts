import type { ApiResponse } from '~~/app/types/api';
import type {
  GalleryMapPageRequest,
  GalleryMapResponse,
  GalleryMapResponseListTotalPageResult,
} from '~~/app/types/gallery-map';
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend';

export default defineEventHandler(async (event) => {
  const body = await readBody<GalleryMapPageRequest>(event);
  const response = await backendFetch<ApiResponse<GalleryMapResponseListTotalPageResult<GalleryMapResponse>>>(
    event,
    '/GalleryMap/PageList',
    {
      method: 'POST',
      body,
    },
  );

  return unwrapApiResponse(response) ?? {
    list: [],
    pageIndex: body.pageIndex || 1,
    pageSize: body.pageSize || 20,
    total: 0,
    totalPages: 0,
  };
});
