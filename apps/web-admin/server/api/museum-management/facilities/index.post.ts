import type { ApiResponse } from '~~/app/types/api';
import type { CreateFacilityPayload } from '~~/app/types/museum';
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend';

export default defineEventHandler(async (event) => {
  const body = await readBody<CreateFacilityPayload>(event);
  const response = await backendFetch<ApiResponse<string>>(event, '/api/Museum/CreateFacility', {
    method: 'POST',
    body,
  });

  return unwrapApiResponse(response);
});
