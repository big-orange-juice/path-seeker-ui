import type { ApiResponse } from '~~/app/types/api';
import type { CreateGalleryMapAnnotationRequest } from '~~/app/types/gallery-map';
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend';

export default defineEventHandler(async (event) => {
  const body = await readBody<CreateGalleryMapAnnotationRequest>(event);
  const response = await backendFetch<ApiResponse<string>>(event, '/GalleryMap/CreateAnnotation', {
    method: 'POST',
    body,
  });

  return unwrapApiResponse(response);
});
