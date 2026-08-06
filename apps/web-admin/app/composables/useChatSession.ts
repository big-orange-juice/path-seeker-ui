import { computed, onBeforeUnmount, ref, shallowRef } from 'vue';
import { v4 as uuidv4 } from 'uuid';
import { useAdminAuthStore } from '@/stores/adminAuth';
import type {
  ChatConfirmationPayload,
  ChatDonePayload,
  ChatErrorPayload,
  ChatEventResponse,
  ChatSuggestionsPayload,
  ChatTextDeltaPayload,
  ChatToolActivity,
  ChatToolCallResultPayload,
  ChatToolCallStartPayload,
  ChatUiMessage,
  ChatRunStatus,
  CreateChatSessionRequest,
} from '@/types/chat';
import { resolveHttpErrorMessage } from '@path-seeker/ts-shared';
import { parseChatEventData, resolveToolStatusLabel } from '@/utils/chat-payload';
import { createSseParser } from '@/utils/sse';

export interface UseChatSessionOptions {
  contextRouteId?: string | null;
  onEvent?: (event: ChatEventResponse) => void;
  onDone?: (payload: ChatDonePayload, event: ChatEventResponse | null) => void;
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

const resolveErrorMessage = (error: unknown, fallback: string) =>
  resolveHttpErrorMessage(error, fallback);

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
  /** 本轮 run 是否已收到 done/error，用于 HTTP 正常收尾时合成 onDone */
  let runTerminalReceived = false;

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
      throw new Error('创建对话失败，请稍后再试。');
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

  const absorbRouteIdFromPayload = (payload: unknown) => {
    if (!payload || typeof payload !== 'object') {
      return;
    }

    const record = payload as Record<string, unknown>;
    const candidate = record.routeId ?? record.id;
    const nextId = candidate != null ? String(candidate).trim() : '';

    if (nextId) {
      contextRouteId.value = nextId;
    }
  };

  const handleEvent = (event: ChatEventResponse) => {
    if (event.eventId) {
      lastEventId.value = String(event.eventId);
    }

    // 中间 UI 事件若带 routeId，写入上下文，供 done 兜底刷新
    if (
      event.type === 'ui.route.list.updated'
      || event.type === 'ui.route.detail.updated'
      || event.type === 'ui.route.stage.updated'
      || event.type === 'ui.route.build.progress'
      || event.type === 'ui.route.build.complete'
    ) {
      absorbRouteIdFromPayload(event.payload);
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
        const toolName = String(payload?.toolName ?? '').trim() || 'unknown';
        const groupId = toolName;

        // 1) 其它工具组若仍 running，先收口（当前组稍后合并计数）
        // 2) 同类 toolName 合并为一条 tag，用 count 表示次数
        const existingIndex = activeTools.value.findIndex((item) => item.id === groupId);

        activeTools.value = activeTools.value.map((item, index) => {
          if (index === existingIndex) {
            return item;
          }

          if (item.status !== 'running') {
            return item;
          }

          return {
            ...item,
            status: 'done' as const,
            pendingCallIds: [],
            label: resolveToolStatusLabel(item.toolName, 'done', item.count),
          };
        });

        if (existingIndex >= 0) {
          const existing = activeTools.value[existingIndex]!;
          const nextCount = Math.max(1, existing.count) + 1;
          const pendingCallIds = existing.pendingCallIds.includes(callId)
            ? existing.pendingCallIds
            : [...existing.pendingCallIds, callId];

          activeTools.value = activeTools.value.map((item, index) =>
            index === existingIndex
              ? {
                  ...item,
                  callId,
                  count: nextCount,
                  pendingCallIds,
                  status: 'running',
                  label: resolveToolStatusLabel(toolName, 'running', nextCount),
                }
              : item,
          );
        } else {
          activeTools.value = [
            ...activeTools.value,
            {
              id: groupId,
              callId,
              toolName,
              count: 1,
              pendingCallIds: [callId],
              label: resolveToolStatusLabel(toolName, 'running', 1),
              status: 'running',
            },
          ];
        }

        break;
      }

      case 'tool.call.result': {
        const payload = event.payload as ChatToolCallResultPayload;
        const callId = String(payload?.callId ?? '');

        if (!callId) {
          break;
        }

        activeTools.value = activeTools.value.map((item) => {
          const matched =
            item.callId === callId
            || item.pendingCallIds.includes(callId);

          if (!matched) {
            return item;
          }

          const pendingCallIds = item.pendingCallIds.filter((id) => id !== callId);
          const status = pendingCallIds.length > 0 ? 'running' as const : 'done' as const;

          return {
            ...item,
            pendingCallIds,
            status,
            label: resolveToolStatusLabel(item.toolName, status, item.count),
          };
        });
        break;
      }

      case 'confirmation.required': {
        const payload = event.payload as ChatConfirmationPayload;
        pendingConfirmation.value = payload;
        options.onConfirmationRequired?.(payload, event);
        break;
      }

      case 'suggestions': {
        // done 之前下发；失败时 items 为空数组，不影响主回答
        const payload = (event.payload ?? {}) as ChatSuggestionsPayload;
        const items = Array.isArray(payload.items)
          ? payload.items.map((item) => String(item ?? '').trim()).filter(Boolean)
          : [];

        if (activeAssistantId) {
          updateMessage(activeAssistantId, {
            suggestions: items,
          });
        }
        break;
      }

      case 'done': {
        const payload = (event.payload ?? {}) as ChatDonePayload;
        runTerminalReceived = true;
        runStatus.value = 'completed';
        activeTools.value = activeTools.value.map((item) => ({
          ...item,
          status: 'done' as const,
          pendingCallIds: [],
          label: resolveToolStatusLabel(item.toolName, 'done', item.count),
        }));

        if (activeAssistantId) {
          updateMessage(activeAssistantId, {
            status: 'completed',
            runId: String(event.runId || ''),
          });
        }

        // 保证 done 回调一定带上可用 routeId，便于 UI 刷新
        const resolvedRouteId = String(payload.routeId || contextRouteId.value || '').trim();
        if (resolvedRouteId) {
          contextRouteId.value = resolvedRouteId;
          payload.routeId = resolvedRouteId;
        }

        options.onDone?.(payload, event);
        abortController = null;
        activeAssistantId = '';
        break;
      }

      case 'error': {
        const payload = (event.payload ?? {}) as ChatErrorPayload;
        runTerminalReceived = true;
        const message = String(payload.message || '对话处理失败。');
        runStatus.value = 'failed';
        errorMessage.value = message;
        activeTools.value = activeTools.value.map((item) => ({
          ...item,
          status: 'done' as const,
          pendingCallIds: [],
          label: resolveToolStatusLabel(item.toolName, 'done', item.count),
        }));

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

    // 流正常结束但未收到 done/error：按成功收尾并合成 onDone，保证 UI 至少刷新一次
    if (!terminated && runStatus.value === 'running' && !runTerminalReceived) {
      runStatus.value = 'completed';
      activeTools.value = activeTools.value.map((item) => ({
        ...item,
        status: 'done' as const,
        pendingCallIds: [],
        label: resolveToolStatusLabel(item.toolName, 'done', item.count),
      }));

      if (activeAssistantId) {
        updateMessage(activeAssistantId, {
          status: 'completed',
        });
      }

      const syntheticPayload: ChatDonePayload = {
        assistantMessageId: null,
        routeId: contextRouteId.value || null,
        routeVersion: null,
      };
      runTerminalReceived = true;
      options.onDone?.(syntheticPayload, null);
      activeAssistantId = '';
    }
  };

  const sendMessage = async (
    rawMessage: string,
    optionsOverride?: {
      clientMessageId?: string;
      /** 实际发给后端的完整文本；缺省等于展示用 rawMessage */
      wireMessage?: string;
    },
  ) => {
    const displayMessage = rawMessage.trim();
    const wireMessage = String(optionsOverride?.wireMessage ?? rawMessage).trim();

    if (!displayMessage || !wireMessage) {
      return;
    }

    if (isRunning.value) {
      return;
    }

    errorMessage.value = '';
    pendingConfirmation.value = null;
    activeTools.value = [];
    runStatus.value = 'running';
    runTerminalReceived = false;

    const clientMessageId = optionsOverride?.clientMessageId || uuidv4();
    const userMessage = createLocalMessage('user', displayMessage, 'completed', { clientMessageId });
    const assistantMessage = createLocalMessage('assistant', '', 'pending');
    activeAssistantId = assistantMessage.id;
    messages.value = [...messages.value, userMessage, assistantMessage];

    abortController = new AbortController();

    try {
      const ensuredSessionId = await ensureSession(displayMessage);
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
          message: wireMessage,
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

      // 双保险：流已结束仍未 terminal 时再合成一次 done（consume 内已处理多数路径）
      if (runStatus.value === 'running' && !runTerminalReceived) {
        runStatus.value = 'completed';
        updateMessage(assistantMessage.id, { status: 'completed' });
        runTerminalReceived = true;
        options.onDone?.(
          {
            assistantMessageId: null,
            routeId: contextRouteId.value || null,
            routeVersion: null,
          },
          null,
        );
        activeAssistantId = '';
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
