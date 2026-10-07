<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue';
import ChatPanel from '@/components/chat/ChatPanel.vue';
import RouteChatPreviewPane from '@/components/routes/RouteChatPreviewPane.vue';
import { useChatSession } from '@/composables/useChatSession';
import { useRouteBuildTaskProgress } from '@/composables/useRouteBuildTaskProgress';
import type {
  ChatDonePayload,
  ChatComposerSubmitPayload,
  ChatEventResponse,
  ChatExhibitListItem,
  ChatExhibitSelectedPayload,
  ChatExhibitSummary,
  ChatRouteBuildProgressPayload,
  ChatRouteDetailPayload,
  ChatRouteListUpdatedPayload,
  ChatRouteBuildCompletePayload,
} from '@/types/chat';

interface Props {
  active?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  active: true,
});

const emit = defineEmits<{
  routeChanged: [routeId: string];
  routePublished: [routeId: string];
  /** 本轮 SSE 正常结束且已有 routeId（仅新建工作台使用，编辑侧不挂此组件） */
  runCompleted: [routeId: string];
}>();

const routeDetail = ref<ChatRouteDetailPayload | null>(null);
const exhibits = ref<ChatExhibitSummary[]>([]);
const publishedHint = ref('');
const seenProgressEventIds = new Set<string>();

let stageRefreshTimer: ReturnType<typeof setTimeout> | null = null;

const clearStageRefreshTimer = () => {
  if (stageRefreshTimer) {
    clearTimeout(stageRefreshTimer);
    stageRefreshTimer = null;
  }
};

const clearBuildProgress = () => {
  seenProgressEventIds.clear();
  clearStageRefreshTimer();
};

const scheduleStageRefresh = (routeId: string) => {
  if (!routeId || stageRefreshTimer) {
    return;
  }

  stageRefreshTimer = setTimeout(() => {
    stageRefreshTimer = null;
    emit('routeChanged', routeId);
  }, 600);
};

/**
 * 处理 SSE 的站点构建进度事件。
 *
 * 进度展示已改为轮询 /api/Route/TaskStatus（见 useRouteBuildTaskProgress），
 * 这里只保留「节点变化后让路线列表跟上」的刷新副作用，不再聚合展示用的计数。
 */
const applyBuildProgress = (event: ChatEventResponse) => {
  const eventId = String(event.eventId || '').trim();

  if (eventId) {
    if (seenProgressEventIds.has(eventId)) {
      return;
    }

    seenProgressEventIds.add(eventId);
  }

  const payload = (event.payload ?? {}) as ChatRouteBuildProgressPayload;
  const routeId = String(payload.routeId ?? '').trim();

  if (!routeId) {
    return;
  }

  if (payload.status === 'succeeded') {
    scheduleStageRefresh(routeId);
    return;
  }

  if (payload.status === 'completed' || payload.status === 'failed') {
    clearStageRefreshTimer();
    emit('routeChanged', routeId);
  }
};

const mapExhibitItem = (item: ChatExhibitListItem | null | undefined): ChatExhibitSummary | null => {
  if (!item || typeof item !== 'object') {
    return null;
  }

  const idValue = item.exhibitId ?? item.id;
  const nameValue = item.name;
  const id = idValue != null && String(idValue).trim() ? String(idValue) : null;
  const name = nameValue != null && String(nameValue).trim() ? String(nameValue) : null;

  if (!id && !name) {
    return null;
  }

  return {
    id,
    name,
    dynasty: item.dynasty != null ? String(item.dynasty) : null,
    category: item.category != null ? String(item.category) : null,
    exhibitCode: item.exhibitCode != null ? String(item.exhibitCode) : null,
  };
};

const normalizeExhibits = (payload: ChatExhibitSelectedPayload): ChatExhibitSummary[] => {
  if (Array.isArray(payload)) {
    return payload
      .map((item) => mapExhibitItem(item))
      .filter((item): item is ChatExhibitSummary => Boolean(item));
  }

  if (!payload || typeof payload !== 'object') {
    return [];
  }

  const record = payload as Record<string, unknown>;

  // 实际后端：{ query, count, exhibits: [{ exhibitId, name, ... }] }
  const nestedLists = [record.exhibits, record.items, record.list, record.data];
  for (const candidate of nestedLists) {
    if (Array.isArray(candidate)) {
      return candidate
        .map((item) => mapExhibitItem(item as ChatExhibitListItem))
        .filter((item): item is ChatExhibitSummary => Boolean(item));
    }
  }

  // 单件详情：{ exhibit, archive }
  if (record.exhibit && typeof record.exhibit === 'object') {
    const mapped = mapExhibitItem(record.exhibit as ChatExhibitListItem);
    return mapped ? [mapped] : [];
  }

  // 顶层即单文物
  const mapped = mapExhibitItem(record as ChatExhibitListItem);
  return mapped ? [mapped] : [];
};

const mergeExhibits = (next: ChatExhibitSummary[]) => {
  const map = new Map<string, ChatExhibitSummary>();

  for (const item of exhibits.value) {
    const key = String(item.id || item.name || '');
    if (key) {
      map.set(key, item);
    }
  }

  for (const item of next) {
    const key = String(item.id || item.name || '');
    if (key) {
      map.set(key, item);
    }
  }

  exhibits.value = Array.from(map.values()).slice(-20);
};

const handleUiEvent = (event: ChatEventResponse) => {
  switch (event.type) {
    case 'ui.exhibit.selected': {
      mergeExhibits(normalizeExhibits(event.payload as ChatExhibitSelectedPayload));
      break;
    }

    case 'ui.route.list.updated': {
      const payload = event.payload as ChatRouteListUpdatedPayload;
      const routeId = String(payload?.routeId ?? '').trim();
      const routeName = String(payload?.routeName ?? '').trim();

      if (routeId) {
        routeDetail.value = {
          ...(routeDetail.value ?? {}),
          id: routeId,
          title: routeName || routeDetail.value?.title || null,
        };
        emit('routeChanged', routeId);
      } else if (routeName) {
        routeDetail.value = {
          ...(routeDetail.value ?? {}),
          title: routeName,
        };
      }

      break;
    }

    case 'ui.route.detail.updated': {
      const payload = (event.payload ?? {}) as ChatRouteDetailPayload;
      routeDetail.value = {
        ...(routeDetail.value ?? {}),
        ...payload,
        id: payload.id != null ? String(payload.id) : routeDetail.value?.id ?? null,
        title: payload.title != null && String(payload.title).trim()
          ? String(payload.title)
          : routeDetail.value?.title ?? null,
      };

      if (payload.id) {
        emit('routeChanged', String(payload.id));
      }

      break;
    }

    case 'ui.route.stage.updated': {
      const payload = event.payload as { routeId?: string | null };
      const routeId = String(payload?.routeId ?? routeDetail.value?.id ?? '').trim();

      if (routeId) {
        emit('routeChanged', routeId);
      }

      break;
    }

    case 'ui.route.build.progress': {
      applyBuildProgress(event);
      break;
    }

    case 'ui.route.build.complete': {
      const payload = event.payload as ChatRouteBuildCompletePayload;
      const routeId = String(payload?.routeId ?? '').trim();

      if (routeId) {
        emit('routeChanged', routeId);

        if (payload?.published) {
          publishedHint.value = '路线状态已更新，请在列表中继续提交审核或上架';
          emit('routePublished', routeId);
        }
      }

      break;
    }

    default:
      break;
  }
};

const {
  messages,
  activeTools,
  errorMessage,
  isRunning,
  contextRouteId,
  sendMessage,
  retryLastFailed,
  cancelRun,
  resetSession: resetChatSession,
  abortActiveRun,
} = useChatSession({
  onEvent: handleUiEvent,
  onDone: (payload: ChatDonePayload) => {
    // useChatSession 已把 contextRouteId 回填进 payload.routeId
    // 终态只发 runCompleted，由新建页统一刷新列表 + 按需提示后台任务，避免与 routeChanged 双刷
    const routeId = String(payload.routeId || routeDetail.value?.id || '').trim();

    if (routeId) {
      emit('runCompleted', routeId);
    }
  },
});

const handleSend = (payload: ChatComposerSubmitPayload) =>
  sendMessage(payload.message, {
    attachmentFiles: payload.images,
    attachmentIds: payload.attachmentIds,
    attachmentReferences: payload.attachmentReferences,
  });

/** 当前路线 ID：对话流会先给 contextRouteId，详情事件随后补齐 id */
const currentRouteId = () =>
  String(routeDetail.value?.id || contextRouteId.value || '').trim();

// 右侧「创建进度」不依赖 SSE：面板在前台且有 routeId 时按固定节奏轮询 TaskStatus 汇总，
// 这样对话流断开、或后台任务在轮次结束后才入队，右侧进度都还能继续更新。
const { progress: creationProgress } = useRouteBuildTaskProgress({
  routeId: currentRouteId,
  active: () => props.active,
});

const resetSession = () => {
  clearBuildProgress();
  resetChatSession();
};

// active 仅表示是否在前台展示，切 tab 不中断 SSE；关闭 dialog 由父级 abortActiveRun

// 新一轮对话开始时清掉上一批 SSE 事件去重记录，避免残留。
watch(isRunning, (running, wasRunning) => {
  if (running && !wasRunning) {
    clearBuildProgress();
  }
});

onBeforeUnmount(() => {
  clearStageRefreshTimer();
  abortActiveRun();
});

defineExpose({
  resetSession,
  abortActiveRun,
});
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col px-5 py-4">
    <ChatPanel
      :messages="messages"
      :tools="activeTools"
      :is-running="isRunning"
      :error-message="errorMessage"
      empty-title="用对话创建主题路线"
      empty-description="例如：帮我创建一条关于宋代瓷器的讲解路线，覆盖 6 到 8 个站点。"
      placeholder="描述主题、受众、站点数量或讲解风格…"
      @send="handleSend"
      @cancel="cancelRun"
      @retry="retryLastFailed"
      @suggestion="sendMessage">
      <template #aside>
        <RouteChatPreviewPane
          :route-detail="routeDetail"
          :exhibits="exhibits"
          :creation-progress="creationProgress"
          :context-route-id="contextRouteId"
          :published-hint="publishedHint" />
      </template>
    </ChatPanel>
  </div>
</template>
