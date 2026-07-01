import type { ApiResponse } from '~~/app/types/api';
import type {
  MuseumPageRequest,
  MuseumResponse,
  MuseumResponseListTotalPageResult,
} from '~~/app/types/museum';
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend';

export default defineEventHandler(async (event) => {
  const body = await readBody<MuseumPageRequest>(event);
  const response = await backendFetch<ApiResponse<MuseumResponseListTotalPageResult<MuseumResponse>>>(
    event,
    '/api/Museum/PageList',
    {
      method: 'POST',
      body,
    }
  );

  return unwrapApiResponse(response) ?? {
    list: [],
    pageIndex: body.pageIndex || 1,
    pageSize: body.pageSize || 10,
    total: 0,
    totalPages: 0,
  };
});
