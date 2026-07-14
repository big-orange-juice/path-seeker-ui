import { computed, onBeforeUnmount, ref, shallowRef } from 'vue';
import { v4 as uuidv4 } from 'uuid';
import { useAdminAuthStore } from '@/stores/adminAuth';
import type {
  ChatConfirmationPayload,
  ChatDonePayload,
  ChatErrorPayload,
  ChatEventResponse,
  ChatTextDeltaPayload,
  ChatToolActivity,
  ChatToolCallResultPayload,
  ChatToolCallStartPayload,
  ChatUiMessage,
  ChatRunStatus,
  CreateChatSessionRequest,
} from '@/types/chat';
import { parseChatEventData, resolveToolStatusLabel } from '@/utils/chat-payload';
import { createSseParser } from '@/utils/sse';

export interface UseChatSessionOptions {
  contextRouteId?: string | null;
  onEvent?: (event: ChatEventResponse) => void;
  onDone?: (payload: ChatDonePayload, event: ChatEventResponse) => void;
  onError?: (payload: ChatErrorPayload, event: ChatEventResponse | null) => void;
  onConfirmationRequired?: (payload: ChatConfirmationPayload, event: ChatEventResponse) => void;
}

const createLocalMessage = (
  role: ChatUiMessage['role'],
  content: string,
  status: ChatUiMessage['status'],
  extra?: Partial<ChatUiMessage>,
): ChatUiMessage => ({
  id: uuidv4(),
  role,
  content,
  status,
  createdAt: Date.now(),
  ...extra,
});

const resolveErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>;
    if (typeof record.statusMessage === 'string' && record.statusMessage) {
      return record.statusMessage;
    }
    if (typeof record.message === 'string' && record.message) {
      return record.message;
    }
  }

  return fallback;
};

const resolveAppApiUrl = (baseURL: string, path: string) => {
  const normalizedBase = String(baseURL || '/').replace(/\/?$/, '/');
  const normalizedPath = path.replace(/^\//, '');
  return `${normalizedBase}${normalizedPath}`;
};

export const useChatSession = (options: UseChatSessionOptions = {}) => {
  const { request } = useApiClient();
  const authStore = useAdminAuthStore();
  const runtimeConfig = useRuntimeConfig();

  const sessionId = ref('');
  const messages = ref<ChatUiMessage[]>([]);
  const runStatus = ref<ChatRunStatus>('idle');
  const activeTools = ref<ChatToolActivity[]>([]);
  const lastEventId = ref('');
  const errorMessage = ref('');
  const pendingConfirmation = shallowRef<ChatConfirmationPayload | null>(null);
  const contextRouteId = ref(options.contextRouteId ? String(options.contextRouteId) : '');

  let abortController: AbortController | null = null;
  let activeAssistantId = '';

  const isRunning = computed(() => runStatus.value === 'running');
  const canSend = computed(() => !isRunning.value);

  const resetSession = () => {
    abortActiveRun();
    sessionId.value = '';
    messages.value = [];
    runStatus.value = 'idle';
    activeTools.value = [];
    lastEventId.value = '';
    errorMessage.value = '';
    pendingConfirmation.value = null;
    activeAssistantId = '';
  };

  const abortActiveRun = () => {
    if (abortController) {
      abortController.abort();
      abortController = null;
    }
  };

  const ensureSession = async (seedTitle?: string) => {
    if (sessionId.value) {
      return sessionId.value;
    }

    const payload: CreateChatSessionRequest = {
      title: seedTitle?.slice(0, 256) || null,
      contextRouteId: contextRouteId.value || null,
    };

    const created = await request<string>('/api/chat/sessions', {
      method: 'POST',
      body: payload,
    });

    const nextId = String(created ?? '').trim();

    if (!nextId) {
      throw new Error('创建会话失败，未返回会话 ID。');
    }

    sessionId.value = nextId;
    return nextId;
  };

  const updateMessage = (id: string, patch: Partial<ChatUiMessage>) => {
    messages.value = messages.value.map((item) =>
      item.id === id
        ? {
            ...item,
            ...patch,
          }
        : item,
    );
  };

  const appendAssistantDelta = (content: string) => {
    if (!activeAssistantId) {
      return;
    }

    const target = messages.value.find((item) => item.id === activeAssistantId);

    if (!target) {
      return;
    }

    updateMessage(activeAssistantId, {
      content: `${target.content}${content}`,
      status: 'streaming',
    });
  };

  const handleEvent = (event: ChatEventResponse) => {
    if (event.eventId) {
      lastEventId.value = String(event.eventId);
    }

    options.onEvent?.(event);

    switch (event.type) {
      case 'heartbeat': {
        runStatus.value = 'running';
        break;
      }

      case 'text.delta': {
        const payload = event.payload as ChatTextDeltaPayload;
        const content = String(payload?.content ?? '');

        if (content) {
          appendAssistantDelta(content);
        }

        break;
      }

      case 'tool.call.start': {
        const payload = event.payload as ChatToolCallStartPayload;
        const callId = String(payload?.callId ?? uuidv4());
        const toolName = String(payload?.toolName ?? '');

        activeTools.value = [
          ...activeTools.value.filter((item) => item.callId !== callId),
          {
            callId,
            toolName,
            label: resolveToolStatusLabel(toolName),
            status: 'running',
          },
        ];
        break;
      }

      case 'tool.call.result': {
        const payload = event.payload as ChatToolCallResultPayload;
        const callId = String(payload?.callId ?? '');

        if (!callId) {
          break;
        }

        activeTools.value = activeTools.value.map((item) =>
          item.callId === callId
            ? {
                ...item,
                status: 'done',
              }
            : item,
        );
        break;
      }

      case 'confirmation.required': {
        const payload = event.payload as ChatConfirmationPayload;
        pendingConfirmation.value = payload;
        options.onConfirmationRequired?.(payload, event);
        break;
      }

      case 'done': {
        const payload = (event.payload ?? {}) as ChatDonePayload;
        runStatus.value = 'completed';
        activeTools.value = activeTools.value.map((item) => ({
          ...item,
          status: 'done',
        }));

        if (activeAssistantId) {
          updateMessage(activeAssistantId, {
            status: 'completed',
            runId: String(event.runId || ''),
          });
        }

        if (payload.routeId) {
          contextRouteId.value = String(payload.routeId);
        }

        options.onDone?.(payload, event);
        abortController = null;
        activeAssistantId = '';
        break;
      }

      case 'error': {
        const payload = (event.payload ?? {}) as ChatErrorPayload;
        const message = String(payload.message || '对话处理失败。');
        runStatus.value = 'failed';
        errorMessage.value = message;

        if (activeAssistantId) {
          updateMessage(activeAssistantId, {
            status: 'failed',
            errorMessage: message,
            runId: String(event.runId || ''),
          });
        }

        options.onError?.(payload, event);
        abortController = null;
        activeAssistantId = '';
        break;
      }

      default:
        break;
    }
  };

  const consumeSseStream = async (response: Response) => {
    if (!response.body) {
      throw new Error('未收到可读的事件流。');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let terminated = false;

    const parser = createSseParser((rawEvent) => {
      const event = parseChatEventData(rawEvent.data);

      if (!event) {
        return;
      }

      if (!event.type && rawEvent.event) {
        event.type = rawEvent.event;
      }

      if (!event.eventId && rawEvent.id) {
        event.eventId = rawEvent.id;
      }

      handleEvent(event);

      if (event.type === 'done' || event.type === 'error') {
        terminated = true;
      }
    });

    while (!terminated) {
      const { done, value } = await reader.read();

      if (done) {
        parser.end();
        break;
      }

      parser.push(decoder.decode(value, { stream: true }));
    }

    if (!terminated && runStatus.value === 'running') {
      runStatus.value = 'unknown';
      errorMessage.value = '连接已中断，请稍后重试或刷新历史。';

      if (activeAssistantId) {
        updateMessage(activeAssistantId, {
          status: 'failed',
          errorMessage: errorMessage.value,
        });
      }
    }
  };

  const sendMessage = async (rawMessage: string, optionsOverride?: { clientMessageId?: string }) => {
    const message = rawMessage.trim();

    if (!message) {
      return;
    }

    if (isRunning.value) {
      return;
    }

    errorMessage.value = '';
    pendingConfirmation.value = null;
    activeTools.value = [];
    runStatus.value = 'running';

    const clientMessageId = optionsOverride?.clientMessageId || uuidv4();
    const userMessage = createLocalMessage('user', message, 'completed', { clientMessageId });
    const assistantMessage = createLocalMessage('assistant', '', 'pending');
    activeAssistantId = assistantMessage.id;
    messages.value = [...messages.value, userMessage, assistantMessage];

    abortController = new AbortController();

    try {
      const ensuredSessionId = await ensureSession(message);
      const sendUrl = resolveAppApiUrl(String(runtimeConfig.app.baseURL || '/'), '/api/chat/send');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      };

      if (authStore.token) {
        headers.Authorization = authStore.token.startsWith('Bearer ')
          ? authStore.token
          : `Bearer ${authStore.token}`;
      }

      if (lastEventId.value) {
        headers['Last-Event-ID'] = lastEventId.value;
      }

      const response = await fetch(sendUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          sessionId: ensuredSessionId,
          clientMessageId,
          message,
        }),
        signal: abortController.signal,
        credentials: 'same-origin',
      });

      if (!response.ok) {
        let detail = `请求失败（${response.status}）`;

        try {
          const payload = await response.json() as {
            statusMessage?: string;
            message?: string;
            data?: { message?: string };
          };
          detail = payload.statusMessage
            || payload.message
            || payload.data?.message
            || detail;

          if (response.status === 401) {
            authStore.openSessionExpiredDialog(detail);
          }
        } catch {
          // ignore parse failure
        }

        throw new Error(detail);
      }

      updateMessage(assistantMessage.id, { status: 'streaming' });
      await consumeSseStream(response);

      if (runStatus.value === 'running') {
        runStatus.value = 'completed';
        updateMessage(assistantMessage.id, { status: 'completed' });
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        runStatus.value = 'idle';
        updateMessage(assistantMessage.id, {
          status: 'failed',
          errorMessage: '已取消发送。',
        });
        return;
      }

      const detail = resolveErrorMessage(error, '发送消息失败。');
      runStatus.value = 'failed';
      errorMessage.value = detail;
      updateMessage(assistantMessage.id, {
        status: 'failed',
        errorMessage: detail,
      });
      options.onError?.({ code: 'client_error', message: detail }, null);
    } finally {
      abortController = null;
    }
  };

  const retryLastFailed = async () => {
    const lastUser = [...messages.value].reverse().find((item) => item.role === 'user');
    const lastAssistant = [...messages.value].reverse().find((item) => item.role === 'assistant');

    if (!lastUser || !lastAssistant || lastAssistant.status !== 'failed') {
      return;
    }

    // Drop the failed turn and resend with a new clientMessageId (user-initiated retry).
    const dropIds = new Set([lastUser.id, lastAssistant.id]);
    messages.value = messages.value.filter((item) => !dropIds.has(item.id));
    await sendMessage(lastUser.content);
  };

  const cancelRun = () => {
    abortActiveRun();
    runStatus.value = 'idle';

    if (activeAssistantId) {
      updateMessage(activeAssistantId, {
        status: 'failed',
        errorMessage: '已取消。',
      });
      activeAssistantId = '';
    }
  };

  onBeforeUnmount(() => {
    abortActiveRun();
  });

  return {
    sessionId,
    messages,
    runStatus,
    activeTools,
    lastEventId,
    errorMessage,
    pendingConfirmation,
    contextRouteId,
    isRunning,
    canSend,
    ensureSession,
    sendMessage,
    retryLastFailed,
    cancelRun,
    resetSession,
    abortActiveRun,
  };
};
