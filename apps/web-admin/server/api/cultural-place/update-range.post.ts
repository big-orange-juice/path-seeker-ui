import type { ApiResponse } from '~~/app/types/api';
import type { UpdatePlaceRangeRequest } from '~~/app/types/cultural-place-range';
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend';

/**
 * 更新景点本体范围（点/圆/多边形 + 接近与解除阈值 + 归属片区）。
 *
 * 越界：后端在范围超出父级目的地边界时返回 HTTP 400 + code=12011，
 * 该错误由 `backendFetch` 原样抛出（含 data.code），前端据此引导用户先去扩大父级目的地边界；
 * 越界数据不会落库，这里不做任何吞错处理。对应后端 POST /api/CulturalPlace/UpdateRange
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<UpdatePlaceRangeRequest>(event);
  if (!body?.id?.trim()) throw createError({ statusCode: 400, message: '景点 ID 不能为空。' });
  if (![1, 2, 3].includes(Number(body.rangeType))) {
    throw createError({ statusCode: 400, message: '范围类型仅支持 1=点 2=圆 3=多边形。' });
  }
  if (Number(body.rangeType) === 2 && !(Number(body.rangeRadiusMeters) > 0)) {
    throw createError({ statusCode: 400, message: '圆形范围必须提供大于 0 的半径。' });
  }
  if (Number(body.rangeType) === 3 && !body.boundaryGeoJson?.trim()) {
    throw createError({ statusCode: 400, message: '多边形范围必须绘制或粘贴 GeoJSON。' });
  }

  return unwrapApiResponse(
    await backendFetch<ApiResponse>(event, '/CulturalPlace/UpdateRange', { method: 'POST', body }),
  );
});
