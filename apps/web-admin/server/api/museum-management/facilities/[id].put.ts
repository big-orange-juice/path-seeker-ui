import type { ApiResponse } from '~~/app/types/api';
import type { UpdateFacilityPayload } from '~~/app/types/museum';
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend';

export default defineEventHandler(async (event) => {
  const body = await readBody<UpdateFacilityPayload>(event);
  const response = await backendFetch<ApiResponse>(event, '/api/Museum/UpdateFacility', {
    method: 'POST',
    body,
  });

  return unwrapApiResponse(response);
});
