import type { ApiResponse } from '~~/app/types/api';
import type { UpdateRouteTitlePayload } from '~~/app/types/route';
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend';

export default defineEventHandler(async (event) => {
  const body = await readBody<UpdateRouteTitlePayload>(event);
  const id = String(body?.id ?? '').trim();
  const routeCode = String(body?.routeCode ?? '').trim();
  const title = String(body?.title ?? '').trim();

  if (!id || !routeCode || !title) {
    throw createError({
      statusCode: 400,
      message: '路线 ID、编码和标题不能为空。',
    });
  }

  const response = await backendFetch<ApiResponse>(event, '/Route/Update', {
    method: 'POST',
    body: { id, routeCode, title },
  });

  return unwrapApiResponse(response);
});
