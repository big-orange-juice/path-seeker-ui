import type { ApiResponse } from '~~/app/types/api';
import type { CopyAreaBoundaryRequest } from '~~/app/types/cultural-place-range';
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend';

/**
 * 把所属景区区域边界一次性复制为景点范围（不做运行时引用）。
 * 返回按景点坐标系转换后的 GeoJSON 字符串，供前端预览、人工确认后再调 UpdateRange 保存。
 * 对应后端 POST /api/CulturalPlace/CopyAreaBoundary
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<CopyAreaBoundaryRequest>(event);
  if (!body?.id?.trim()) throw createError({ statusCode: 400, message: '景点 ID 不能为空。' });

  return unwrapApiResponse(
    await backendFetch<ApiResponse<string>>(event, '/CulturalPlace/CopyAreaBoundary', { method: 'POST', body }),
  );
});
