import type { ApiResponse } from '~~/app/types/api';
import type { ExhibitResponse } from '~~/app/types/museum';
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend';

export default defineEventHandler(async (event) => {
  const id = String(getRouterParam(event, 'id') || '').trim();
  if (!id || id === '0') {
    throw createError({ statusCode: 400, message: '文物 ID 不能为空。' });
  }

  const response = await backendFetch<ApiResponse<ExhibitResponse>>(event, '/Exhibit/Get', {
    query: { id },
  });

  return unwrapApiResponse(response);
});
