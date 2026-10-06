import type { ApiResponse } from '~~/app/types/api';
import type { EvaluatePlaceRangeRequest, PlaceRangeEvaluation } from '~~/app/types/cultural-place-range';
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend';

/**
 * 用模拟用户位置校验范围判定结果（范围内 / 距离 / 是否接近）。
 * 注意：判定基于数据库中已保存的范围，未保存的草稿不会参与判定。
 * 对应后端 POST /api/CulturalPlace/EvaluateRange
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<EvaluatePlaceRangeRequest>(event);
  if (!body?.id?.trim()) throw createError({ statusCode: 400, message: '景点 ID 不能为空。' });
  if (!Number.isFinite(Number(body.longitude)) || !Number.isFinite(Number(body.latitude))) {
    throw createError({ statusCode: 400, message: '模拟位置经纬度不合法。' });
  }

  return unwrapApiResponse(
    await backendFetch<ApiResponse<PlaceRangeEvaluation>>(event, '/CulturalPlace/EvaluateRange', {
      method: 'POST',
      body,
    }),
  );
});
