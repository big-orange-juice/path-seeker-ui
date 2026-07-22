import type { ApiResponse } from '~~/app/types/api';
import type { ChatSessionResponse } from '~~/app/types/chat';
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend';

export default defineEventHandler(async (event) => {
  const response = await backendFetch<ApiResponse<ChatSessionResponse[]>>(event, '/Chat/sessions', {
    method: 'GET',
  });

  return unwrapApiResponse(response) ?? [];
});
