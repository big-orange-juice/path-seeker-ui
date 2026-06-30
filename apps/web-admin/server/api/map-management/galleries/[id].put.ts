import type { ApiResponse } from '~~/app/types/api';
import type { UpdateGalleryPayload } from '~~/app/types/museum';
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend';

export default defineEventHandler(async (event) => {
  const body = await readBody<UpdateGalleryPayload>(event);
  const response = await backendFetch<ApiResponse>(event, '/api/Gallery/Update', {
    method: 'POST',
    body,
  });

  return unwrapApiResponse(response);
});
