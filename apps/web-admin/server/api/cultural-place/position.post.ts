import type { ApiResponse } from '~~/app/types/api';
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend';

export default defineEventHandler(async event => {
  const body = await readBody<{ id: string; museumId: string; longitude: number; latitude: number; coordinateSystem: number }>(event);
  return unwrapApiResponse(await backendFetch<ApiResponse>(event, '/CulturalPlace/UpdatePosition', { method: 'POST', body }));
});
