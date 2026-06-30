import type { ApiResponse } from '~~/app/types/api';
import type { UpdateFloorPayload } from '~~/app/types/museum';
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend';

export default defineEventHandler(async (event) => {
  const body = await readBody<UpdateFloorPayload>(event);
  const response = await backendFetch<ApiResponse>(event, '/api/Museum/UpdateFloor', {
    method: 'POST',
    body,
  });

  return unwrapApiResponse(response);
});
