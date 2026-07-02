import type { ApiResponse } from '~~/app/types/api';
import type { CreateExhibitPayload } from '~~/app/types/museum';
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend';

export default defineEventHandler(async (event) => {
  const body = await readBody<CreateExhibitPayload>(event);
  const response = await backendFetch<ApiResponse<string>>(event, '/api/Exhibit/Create', {
    method: 'POST',
    body,
  });

  return unwrapApiResponse(response);
});
