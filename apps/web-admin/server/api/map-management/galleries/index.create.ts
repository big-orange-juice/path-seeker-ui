import type { ApiResponse } from '~~/app/types/api';
import type { CreateGalleryPayload } from '~~/app/types/museum';
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend';

export default defineEventHandler(async (event): Promise<string | null> => {
  const body = await readBody<CreateGalleryPayload>(event);
  const response: ApiResponse<string> = await backendFetch(event, '/api/Gallery/Create', {
    method: 'POST',
    body,
  });

  return unwrapApiResponse(response);
});
