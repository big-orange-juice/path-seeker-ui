import type { ApiResponse } from '~~/app/types/api';
import type { CreateGalleryPayload } from '~~/app/types/museum';
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend';

export default defineEventHandler(async (event) => {
  const body = await readBody<CreateGalleryPayload>(event);
  const response = await backendFetch<ApiResponse<string>>(event, '/Gallery/Create', {
    method: 'POST',
    body,
  });

  return unwrapApiResponse(response);
});
