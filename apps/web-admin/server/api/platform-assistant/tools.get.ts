import type { ApiResponse } from '~~/app/types/api';
import type { PlatformAssistantToolCatalogResponse } from '~~/app/types/platform-assistant';
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend';

/** 当前生效的工具白名单与写入确认策略（默认白名单只含只读工具）。 */
export default defineEventHandler(async (event) => {
  const response = await backendFetch<ApiResponse<PlatformAssistantToolCatalogResponse>>(
    event,
    '/PlatformAssistant/tools',
    { method: 'GET' },
  );

  return unwrapApiResponse(response);
});
