import type { ApiResponse } from '~~/app/types/api';
import type { UpdateMuseumPayload } from '~~/app/types/museum';
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend';

export default defineEventHandler(async (event) => {
  const body = await readBody<UpdateMuseumPayload>(event);
  const response = await backendFetch<ApiResponse>(event, '/api/Museum/Update', {
    method: 'POST',
    body,
  });

  return unwrapApiResponse(response);
});
