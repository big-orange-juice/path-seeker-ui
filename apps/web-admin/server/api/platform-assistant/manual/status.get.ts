import type { ApiResponse } from '~~/app/types/api';
import type { PlatformAssistantManualStatusResponse } from '~~/app/types/platform-assistant';
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend';

/**
 * 手册索引状态：未配置手册路径或文件缺失时后端返回 Configured/FileExists=false，不抛异常，
 * 页面据此给出"未配置/文件不存在"的明确文案。
 */
export default defineEventHandler(async (event) => {
  const response = await backendFetch<ApiResponse<PlatformAssistantManualStatusResponse>>(
    event,
    '/PlatformAssistant/manual/status',
    { method: 'GET' },
  );

  return unwrapApiResponse(response);
});
