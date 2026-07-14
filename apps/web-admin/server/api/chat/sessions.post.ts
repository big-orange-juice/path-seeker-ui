import type { ApiResponse } from '~~/app/types/api';
import type { CreateChatSessionRequest } from '~~/app/types/chat';
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend';

export default defineEventHandler(async (event) => {
  const body = await readBody<CreateChatSessionRequest>(event);
  const response = await backendFetch<ApiResponse<string>>(event, '/api/Chat/sessions', {
    method: 'POST',
    body: {
      title: body?.title ?? null,
      contextRouteId: body?.contextRouteId ?? null,
    },
  });

  return unwrapApiResponse(response);
});
