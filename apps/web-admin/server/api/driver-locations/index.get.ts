import type { ApiResponse } from '~~/app/types/api';
import type { DriverLocationSnapshot } from '~~/app/types/driver-location';
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend';

export default defineEventHandler(async event => {
  setHeader(event, 'Cache-Control', 'no-store');
  return unwrapApiResponse(await backendFetch<ApiResponse<DriverLocationSnapshot>>(event, '/DriverLocations'));
});
