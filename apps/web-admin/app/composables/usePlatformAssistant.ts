import { computed, ref, shallowRef } from 'vue';
import { useApiClient } from '@/composables/useApiClient';
import { useChatSession, type UseChatSessionOptions } from '@/composables/useChatSession';
import type { ChatEventResponse } from '@/types/chat';
import type {
  PlatformAssistantConfirmResponse,
  PlatformAssistantContextDrop,
  PlatformAssistantContextRequest,
  PlatformAssistantContextResponse,
  PlatformAssistantManualHit,
  PlatformAssistantToolCatalogResponse,
} from '@/types/platform-assistant';
import {
  describePlatformAssistantError,
  extractManualCitations,
  formatAssistantTime,
  mergeManualCitations,
} from '@/utils/platform-assistant';

/**
 * 平台助手（全局助手，设计文档 §8）会话与上下文。
 *
 * 对接后端 PlatformAssistantController（全部 [AdminOnly]）：
 * - 会话：POST/GET /api/PlatformAssistant/sessions、GET /history、POST /archive，
 *   场景固定 scene=platform，不绑定 routeId/stageId，与页面内 Chat **彻底隔离**
 *   （独立 sessionId，独立接口路径，不复用 Chat 的会话路由）。
 * - 页面上下文：把 usePlatformAssistantPageContext 推导出的显式字段 POST 到 /context，
 *   后端用 IRouteDataPermissionService / IGuideDataPermissionService 重新核验并裁剪；
 *   **前端传入的上下文一律不视为已授权**，UI 只展示后端返回的核验结果与 dropped 原因。
 * - SSE：POST /send 的事件格式与 Chat 一致（同一条 ChatSessionService 事件管道），
 *   因此复用 useChatSession 的 SSE 解析与消息状态机，仅覆盖接口路径。
 * - 写工具逐次确认：SSE 出现 confirmation.required 时由抽屉弹窗确认，POST /confirm 换取
 *   一次性许可；默认白名单只含只读工具，这条路径默认不激活但代码可用。
 * - 手册出处：从 AskManual/SearchManual 的 tool.call.result 里解析章节 + 页码。
 */

export const PLATFORM_ASSISTANT_API = {
  sessions: '/api/platform-assistant/sessions',
  history: '/api/platform-assistant/history',
  archive: '/api/platform-assistant/archive',
  context: '/api/platform-assistant/context',
  send: '/api/platform-assistant/send',
  confirm: '/api/platform-assistant/confirm',
  tools: '/api/platform-assistant/tools',
  manualStatus: '/api/platform-assistant/manual/status',
  manualReindex: '/api/platform-assistant/manual/reindex',
  manualSearch: '/api/platform-assistant/manual/search',
  manualAsk: '/api/platform-assistant/manual/ask',
} as const;

/**
 * 前端页面上下文：显式字段。
 * pageLabel 只用于前端展示（后端不需要），提交时会被剔除。
 */
export interface PlatformAssistantContext {
  /** 当前前端路由 fullPath（对应后端 path 字段，仅提示用，不参与鉴权） */
  pagePath: string;
  /** 当前页面名称（前端展示用） */
  pageLabel: string;
  museumId: string;
  collectionId: string;
  routeId: string;
  stageId: string;
  guideId: string;
}

export const createEmptyAssistantContext = (): PlatformAssistantContext => ({
  pagePath: '',
  pageLabel: '',
  museumId: '',
  collectionId: '',
  routeId: '',
  stageId: '',
  guideId: '',
});

/** 上下文提交项（前端候选值 / 后端已核验值） */
export interface PlatformAssistantContextEntry {
  key: string;
  label: string;
  value: string;
}

/** 一轮对话命中的手册出处快照 */
export interface PlatformAssistantCitationGroup {
  id: string;
  at: number;
  items: PlatformAssistantManualHit[];
}

export type PlatformAssistantContextSyncStatus = 'idle' | 'syncing' | 'verified' | 'failed';
export type PlatformAssistantConfirmationState = 'idle' | 'confirming' | 'confirmed' | 'failed';

const readId = (value: string | null | undefined): string => String(value ?? '').trim();

export interface UsePlatformAssistantOptions {
  /** 允许调用方补充事件处理（例如页面刷新的 UI 事件） */
  onEvent?: UseChatSessionOptions['onEvent'];
}

export const usePlatformAssistant = (options: UsePlatformAssistantOptions = {}) => {
  const { request } = useApiClient();

  // ---------------- 页面上下文（前端候选值） ----------------
  const context = ref<PlatformAssistantContext>(createEmptyAssistantContext());
  const contextSyncStatus = ref<PlatformAssistantContextSyncStatus>('idle');
  const contextSyncError = ref('');
  const contextSubmittedAt = ref(0);
  const verifiedContext = shallowRef<PlatformAssistantContextResponse | null>(null);

  // ---------------- 工具白名单目录 ----------------
  const toolCatalog = shallowRef<PlatformAssistantToolCatalogResponse | null>(null);
  const toolCatalogLoading = ref(false);
  const toolCatalogError = ref('');

  // ---------------- 写工具逐次确认 ----------------
  const confirmationState = ref<PlatformAssistantConfirmationState>('idle');
  const confirmationError = ref('');
  const confirmedWrite = shallowRef<PlatformAssistantConfirmResponse | null>(null);

  // ---------------- 手册出处（来自 SSE 的 AskManual/SearchManual 结果） ----------------
  const pendingCitations = shallowRef<PlatformAssistantManualHit[]>([]);
  const citationGroups = shallowRef<PlatformAssistantCitationGroup[]>([]);

  const handleEvent = (event: ChatEventResponse) => {
    // tool.call.result 里包含 AskManual/SearchManual 的 citations（章节 + 页码）
    const extracted = extractManualCitations(event.payload);

    if (extracted.length) {
      pendingCitations.value = mergeManualCitations(pendingCitations.value, extracted);
    }

    if (event.type === 'confirmation.required') {
      // 新的确认请求：重置上一次的结果
      confirmationState.value = 'idle';
      confirmationError.value = '';
      confirmedWrite.value = null;
    }

    options.onEvent?.(event);
  };

  const session = useChatSession({
    // 平台助手会话不绑定路线/节点（后端强制 scene=platform、ContextRouteId=null）
    contextRouteId: null,
    endpoints: {
      createSessionPath: PLATFORM_ASSISTANT_API.sessions,
      sendPath: PLATFORM_ASSISTANT_API.send,
    },
    onSessionReady: async (sessionId) => {
      // 每次发送前都用当前页面上下文重新核验一次（失败不阻断发送，仅在侧栏提示）
      await submitContext(sessionId);
    },
    onEvent: handleEvent,
    onDone: () => {
      if (!pendingCitations.value.length) {
        return;
      }

      const group: PlatformAssistantCitationGroup = {
        id: `platform-citation-${Date.now()}`,
        at: Date.now(),
        items: pendingCitations.value,
      };

      citationGroups.value = [group, ...citationGroups.value].slice(0, 10);
      pendingCitations.value = [];
    },
    onError: () => {
      pendingCitations.value = [];
    },
  });

  // ---------------- 上下文提交 ----------------

  const buildContextRequest = (): PlatformAssistantContextRequest => {
    const current = context.value;
    const nullable = (value: string): string | null => readId(value) || null;

    return {
      path: nullable(current.pagePath),
      museumId: nullable(current.museumId),
      collectionId: nullable(current.collectionId),
      routeId: nullable(current.routeId),
      stageId: nullable(current.stageId),
      guideId: nullable(current.guideId),
    };
  };

  /**
   * 提交页面上下文并由后端核验。
   * 内部吞掉异常并写入 contextSyncStatus / contextSyncError，避免阻断消息发送。
   */
  const submitContext = async (
    sessionIdOverride?: string,
  ): Promise<PlatformAssistantContextResponse | null> => {
    const targetSessionId = readId(sessionIdOverride ?? session.sessionId.value);

    if (!targetSessionId) {
      contextSyncStatus.value = 'idle';
      contextSyncError.value = '';
      return null;
    }

    contextSyncStatus.value = 'syncing';
    contextSyncError.value = '';

    try {
      const result = await request<PlatformAssistantContextResponse>(PLATFORM_ASSISTANT_API.context, {
        method: 'POST',
        query: { sessionId: targetSessionId },
        body: buildContextRequest(),
      });

      verifiedContext.value = result ?? null;
      contextSubmittedAt.value = Date.now();
      contextSyncStatus.value = 'verified';
      return verifiedContext.value;
    } catch (error) {
      verifiedContext.value = null;
      contextSyncStatus.value = 'failed';
      contextSyncError.value = describePlatformAssistantError(error, '页面上下文提交失败。');
      return null;
    }
  };

  const retryContext = () => submitContext();

  const contextDrops = computed<PlatformAssistantContextDrop[]>(() => verifiedContext.value?.dropped ?? []);

  const contextVerifiedAt = computed(() => formatAssistantTime(verifiedContext.value?.verifiedAt));
  const contextSubmittedAtLabel = computed(() => formatAssistantTime(contextSubmittedAt.value));

  /** 前端实际提交的字段（候选值，未授权） */
  const submittedEntries = computed<PlatformAssistantContextEntry[]>(() => {
    const current = context.value;
    const rows: PlatformAssistantContextEntry[] = [
      { key: 'path', label: '当前路径', value: current.pagePath || current.pageLabel },
      { key: 'museumId', label: '场馆', value: current.museumId },
      { key: 'collectionId', label: '典藏', value: current.collectionId },
      { key: 'routeId', label: '路线', value: current.routeId },
      { key: 'stageId', label: '路线节点', value: current.stageId },
      { key: 'guideId', label: '解说导游', value: current.guideId },
    ];

    return rows.filter((row) => readId(row.value));
  });

  /** 后端核验通过并保留的上下文对象 */
  const verifiedEntries = computed<PlatformAssistantContextEntry[]>(() => {
    const verified = verifiedContext.value;

    if (!verified) {
      return [];
    }

    const rows: PlatformAssistantContextEntry[] = [];

    if (verified.museum) {
      rows.push({ key: 'museum', label: '场馆', value: `${verified.museum.name}（#${verified.museum.id}）` });
    }

    if (verified.collection) {
      rows.push({
        key: 'collection',
        label: '典藏',
        value: `${verified.collection.name}（#${verified.collection.id}）`,
      });
    }

    if (verified.route) {
      rows.push({
        key: 'route',
        label: '路线',
        value: `${verified.route.title || '未命名路线'}（#${verified.route.id}）`,
      });
    }

    if (verified.stage) {
      rows.push({
        key: 'stage',
        label: '路线节点',
        value: `${verified.stage.title || `第 ${verified.stage.stageNo} 个节点`}（#${verified.stage.id}）`,
      });
    }

    if (verified.guide) {
      rows.push({ key: 'guide', label: '解说导游', value: `${verified.guide.name || '未命名导游'}（#${verified.guide.id}）` });
    }

    return rows;
  });

  function setContext(patch: Partial<PlatformAssistantContext>) {
    context.value = { ...context.value, ...patch };
  }

  /** 清空选中对象（保留当前路由信息） */
  function clearContextSelection() {
    const seed = createEmptyAssistantContext();
    context.value = {
      ...seed,
      pagePath: context.value.pagePath,
      pageLabel: context.value.pageLabel,
    };
  }

  // ---------------- 工具白名单 ----------------

  const loadToolCatalog = async () => {
    if (toolCatalogLoading.value) {
      return toolCatalog.value;
    }

    toolCatalogLoading.value = true;
    toolCatalogError.value = '';

    try {
      const result = await request<PlatformAssistantToolCatalogResponse>(PLATFORM_ASSISTANT_API.tools, {
        method: 'GET',
      });
      toolCatalog.value = result ?? null;
      return toolCatalog.value;
    } catch (error) {
      toolCatalogError.value = describePlatformAssistantError(error, '工具白名单读取失败。');
      return null;
    } finally {
      toolCatalogLoading.value = false;
    }
  };

  // ---------------- 写工具确认 ----------------

  const confirmationVisible = computed(() =>
    Boolean(session.pendingConfirmation.value) || confirmationState.value === 'confirmed');

  const pendingConfirmationToolName = computed(() => {
    const payload = session.pendingConfirmation.value;

    if (!payload) {
      return '';
    }

    return readId(payload.toolName) || readId(payload.operation) || '未知工具';
  });

  const pendingConfirmationMessage = computed(() => {
    const payload = session.pendingConfirmation.value;

    if (!payload) {
      return '';
    }

    return readId(payload.message)
      || `「${pendingConfirmationToolName.value}」会修改平台数据，需要管理员逐次确认后才执行。`;
  });

  /** 确认令牌对应的工具名（确认成功后展示用） */
  const confirmedToolName = computed(() =>
    readId(confirmedWrite.value?.toolName) || pendingConfirmationToolName.value);

  const confirmWrite = async (): Promise<PlatformAssistantConfirmResponse | null> => {
    const payload = session.pendingConfirmation.value;
    const token = readId(payload?.confirmationToken);
    const currentSessionId = readId(session.sessionId.value);

    if (!token || !currentSessionId) {
      confirmationState.value = 'failed';
      confirmationError.value = '缺少确认令牌或会话信息，请重新发起该操作。';
      return null;
    }

    confirmationState.value = 'confirming';
    confirmationError.value = '';

    try {
      const result = await request<PlatformAssistantConfirmResponse>(PLATFORM_ASSISTANT_API.confirm, {
        method: 'POST',
        body: {
          sessionId: currentSessionId,
          confirmationToken: token,
        },
      });

      confirmedWrite.value = result ?? null;
      confirmationState.value = 'confirmed';
      // 确认令牌是一次性的：后端已消费，前端关闭提示避免重复提交
      session.pendingConfirmation.value = null;
      return confirmedWrite.value;
    } catch (error) {
      confirmationState.value = 'failed';
      confirmationError.value = describePlatformAssistantError(
        error,
        '确认失败：确认令牌不存在、已被使用或已过期，请重新发起该操作。',
      );
      return null;
    }
  };

  const dismissConfirmation = () => {
    session.pendingConfirmation.value = null;
    confirmedWrite.value = null;
    confirmationError.value = '';
    confirmationState.value = 'idle';
  };

  /**
   * 确认后再发一次上一条用户指令，让模型用完全相同的参数重试被闸门拦下的工具
   * （后端一次性许可与"工具名 + 参数哈希"绑定，许可用后即焚）。
   */
  const continueAfterConfirm = async (): Promise<boolean> => {
    const lastUser = [...session.messages.value].reverse().find((item) => item.role === 'user');

    if (!lastUser) {
      return false;
    }

    const result = await session.sendMessage(lastUser.content, {
      wireMessage: lastUser.wireMessage,
      attachmentIds: lastUser.attachmentIds,
      attachmentReferences: lastUser.attachments,
    });
    dismissConfirmation();
    return result;
  };

  // ---------------- 会话透传与重置 ----------------

  const resetSession = () => {
    session.resetSession();
    verifiedContext.value = null;
    contextSyncStatus.value = 'idle';
    contextSyncError.value = '';
    contextSubmittedAt.value = 0;
    pendingCitations.value = [];
    citationGroups.value = [];
    confirmationState.value = 'idle';
    confirmationError.value = '';
    confirmedWrite.value = null;
  };

  const sendMessage = (
    rawMessage: string,
    sendOptions?: Parameters<typeof session.sendMessage>[1],
  ) => session.sendMessage(rawMessage, sendOptions);

  const clearCitationGroups = () => {
    citationGroups.value = [];
  };

  return {
    // 页面上下文（前端候选值）
    context,
    setContext,
    clearContextSelection,
    // 后端核验结果
    submitContext,
    retryContext,
    contextSyncStatus,
    contextSyncError,
    contextSubmittedAtLabel,
    contextDrops,
    contextVerifiedAt,
    verifiedContext,
    submittedEntries,
    verifiedEntries,
    // 工具白名单
    toolCatalog,
    toolCatalogLoading,
    toolCatalogError,
    loadToolCatalog,
    // 手册出处（对话内）
    pendingCitations,
    citationGroups,
    clearCitationGroups,
    // 会话（与页面内 Chat 隔离）
    sessionId: session.sessionId,
    messages: session.messages,
    runStatus: session.runStatus,
    activeTools: session.activeTools,
    errorMessage: session.errorMessage,
    isRunning: session.isRunning,
    canSend: session.canSend,
    sendMessage,
    cancelRun: session.cancelRun,
    retryLastFailed: session.retryLastFailed,
    resetSession,
    // 写工具逐次确认
    pendingConfirmation: session.pendingConfirmation,
    confirmationVisible,
    pendingConfirmationToolName,
    pendingConfirmationMessage,
    confirmationState,
    confirmationError,
    confirmedWrite,
    confirmedToolName,
    confirmWrite,
    dismissConfirmation,
    continueAfterConfirm,
  };
};
