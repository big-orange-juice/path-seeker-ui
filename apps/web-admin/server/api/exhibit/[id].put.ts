import type { ApiResponse } from '~~/app/types/api';
import type { UpdateExhibitPayload } from '~~/app/types/museum';
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend';

export default defineEventHandler(async (event) => {
  const body = await readBody<UpdateExhibitPayload>(event);
  const response = await backendFetch<ApiResponse>(event, '/api/Exhibit/Update', {
    method: 'POST',
    body,
  });

  return unwrapApiResponse(response);
});
