import type { ApiResponse } from '~~/app/types/api';
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend';

export default defineEventHandler(async event => {
  const input = getQuery(event);
  const query: Record<string, string> = {};
  for (const key of ['userId', 'roomId', 'afterId', 'from', 'to', 'pageSize']) {
    const value = input[key];
    if (value === undefined) continue;
    if (typeof value !== 'string') throw createError({ statusCode: 400, message: '查询参数格式不正确' });
    query[key] = value;
  }
  setHeader(event, 'Cache-Control', 'no-store');
  return unwrapApiResponse(await backendFetch<ApiResponse<unknown>>(event, '/DriverLocations/history', { query }));
});
