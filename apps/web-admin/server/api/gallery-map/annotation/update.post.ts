import type { ApiResponse } from '~~/app/types/api';
import type { UpdateGalleryMapAnnotationRequest } from '~~/app/types/gallery-map';
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend';

export default defineEventHandler(async (event) => {
  const body = await readBody<UpdateGalleryMapAnnotationRequest>(event);
  const response = await backendFetch<ApiResponse>(event, '/GalleryMap/UpdateAnnotation', {
    method: 'POST',
    body,
  });

  return unwrapApiResponse(response);
});
