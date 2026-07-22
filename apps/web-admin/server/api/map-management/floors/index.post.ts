import type { ApiResponse } from '~~/app/types/api';
import type { CreateFloorPayload } from '~~/app/types/museum';
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend';

export default defineEventHandler(async (event) => {
  const body = await readBody<CreateFloorPayload>(event);
  const response = await backendFetch<ApiResponse<string>>(event, '/Museum/CreateFloor', {
    method: 'POST',
    body,
  });

  return unwrapApiResponse(response);
});
