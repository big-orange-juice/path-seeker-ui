import type { ApiResponse } from '~~/app/types/api';
import type { PlatformAssistantManualStatusResponse } from '~~/app/types/platform-assistant';
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend';

/**
 * 强制按当前手册文件重建索引。
 * 未配置手册路径或文件不存在时后端返回 19002（ManualNotConfigured），
 * 索引构建失败且没有上一可用版本时返回 19003（ManualIndexUnavailable）。
 */
export default defineEventHandler(async (event) => {
  const response = await backendFetch<ApiResponse<PlatformAssistantManualStatusResponse>>(
    event,
    '/PlatformAssistant/manual/reindex',
    { method: 'POST' },
  );

  return unwrapApiResponse(response);
});
