import type { ApiResponse } from '~~/app/types/api';
import type { CreateMuseumPayload } from '~~/app/types/museum';
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend';

export default defineEventHandler(async (event) => {
  const body = await readBody<CreateMuseumPayload>(event);
  const response = await backendFetch<ApiResponse<string>>(event, '/api/Museum/Create', {
    method: 'POST',
    body,
  });

  return unwrapApiResponse(response);
});
