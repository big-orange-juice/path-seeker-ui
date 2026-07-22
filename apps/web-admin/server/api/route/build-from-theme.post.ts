import type { ApiResponse } from '~~/app/types/api';
import type { BuildRouteFromThemePayload } from '~~/app/types/route';
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend';

export default defineEventHandler(async (event) => {
  const body = await readBody<BuildRouteFromThemePayload>(event);
  const response = await backendFetch<ApiResponse<string>>(event, '/Agent/BuildRouteFromTheme', {
    method: 'POST',
    body,
  });

  return unwrapApiResponse(response);
});
