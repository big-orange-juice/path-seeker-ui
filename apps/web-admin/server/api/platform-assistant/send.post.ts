import type { ChatSendRequest } from '~~/app/types/chat';
import { proxyBackendSse } from '~~/server/utils/platform-assistant';

/**
 * 平台助手发送消息（SSE）。
 *
 * 后端契约：POST /api/PlatformAssistant/send（[AdminOnly]），
 * 事件格式与 B 端 Chat 一致（id/event/data，payload 为 ChatEventResponse）。
 * 事件流里出现 confirmation.required 时，抽屉据此弹出写工具逐次确认。
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<ChatSendRequest>(event);
  const sessionId = String(body?.sessionId ?? '').trim();
  const clientMessageId = String(body?.clientMessageId ?? '').trim();
  const message = String(body?.message ?? '').trim();
  const attachmentIds = Array.isArray(body?.attachmentIds)
    ? Array.from(new Set(body.attachmentIds.map((id) => String(id).trim()).filter(Boolean)))
    : [];

  if (
    !sessionId
    || !clientMessageId
    || (!message && !attachmentIds.length)
    || attachmentIds.length > 4
  ) {
    throw createError({
      statusCode: 400,
      message: '平台助手会话信息或消息内容不完整，请重试。',
    });
  }

  return await proxyBackendSse(event, '/PlatformAssistant/send', {
    sessionId,
    clientMessageId,
    message: message || null,
    attachmentIds: attachmentIds.length ? attachmentIds : null,
  });
});
