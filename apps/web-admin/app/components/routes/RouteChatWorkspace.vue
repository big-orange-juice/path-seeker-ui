<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue';
import ChatPanel from '@/components/chat/ChatPanel.vue';
import RouteChatPreviewPane from '@/components/routes/RouteChatPreviewPane.vue';
import { useChatSession } from '@/composables/useChatSession';
import type {
  ChatDonePayload,
  ChatEventResponse,
  ChatExhibitListItem,
  ChatExhibitSelectedPayload,
  ChatExhibitSummary,
  ChatRouteBuildProgressPayload,
  ChatRouteBuildProgressState,
  ChatRouteBuildProgressStatus,
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
}>();

const routeDetail = ref<ChatRouteDetailPayload | null>(null);
const exhibits = ref<ChatExhibitSummary[]>([]);
const publishedHint = ref('');
const buildProgress = ref<ChatRouteBuildProgressState | null>(null);
const seenProgressEventIds = new Set<string>();

let stageRefreshTimer: ReturnType<typeof setTimeout> | null = null;

const clearStageRefreshTimer = () => {
  if (stageRefreshTimer) {
    clearTimeout(stageRefreshTimer);
    stageRefreshTimer = null;
  }
};

const clearBuildProgress = () => {
  buildProgress.value = null;
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

const toCount = (value: number | null | undefined) => {
  const next = Number(value);
  return Number.isFinite(next) && next >= 0 ? next : 0;
};

const normalizeProgressStatus = (
  value: ChatRouteBuildProgressPayload['status'],
): ChatRouteBuildProgressStatus => {
  if (value === 'running' || value === 'succeeded' || value === 'failed' || value === 'completed') {
    return value;
  }

  return 'running';
};

const uniqueStageIds = (ids: string[]) => {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const id of ids) {
    if (!id || seen.has(id)) {
      continue;
    }

    seen.add(id);
    result.push(id);
  }

  return result;
};

const resolveProgressMessage = (input: {
  status: ChatRouteBuildProgressStatus;
  currentIndex: number;
  totalCount: number;
  createdCount: number;
  exhibitName: string | null;
  payloadMessage: string;
}) => {
  const { status, currentIndex, totalCount, createdCount, exhibitName, payloadMessage } = input;

  if (status === 'running') {
    if (totalCount > 0 && currentIndex > 0) {
      const head = `正在创建第 ${currentIndex} 个节点，累计 ${createdCount}/${totalCount}`;
      return exhibitName ? `${head} · ${exhibitName}` : head;
    }

    return payloadMessage || '正在创建节点';
  }

  if (status === 'succeeded') {
    return totalCount > 0
      ? `已创建 ${createdCount} 个节点，共 ${totalCount} 个`
      : payloadMessage || '节点创建成功';
  }

  if (status === 'failed') {
    return payloadMessage || '节点创建失败';
  }

  return createdCount > 0
    ? `节点生成完成，共创建 ${createdCount} 个`
    : payloadMessage || '节点生成完成';
};

const isNewBuildBatch = (
  previous: ChatRouteBuildProgressState,
  next: {
    interactionType: number;
    status: ChatRouteBuildProgressStatus;
    currentIndex: number;
    createdCount: number;
    processedCount: number;
  },
) => {
  if (previous.interactionType !== next.interactionType) {
    return true;
  }

  // 同玩法下开启新一轮 BuildStagesByAgent：序号回到 1，或本批计数被清零。
  if (next.status === 'running' && next.currentIndex <= 1) {
    if (previous.status === 'completed' || previous.status === 'failed') {
      return true;
    }

    if (previous.createdCount > 0 && next.createdCount === 0 && next.processedCount === 0) {
      return true;
    }
  }

  return false;
};

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
  const runId = String(event.runId || '').trim();
  const interactionType = toCount(payload.interactionType);
  const status = normalizeProgressStatus(payload.status);
  const payloadCurrentIndex = toCount(payload.currentIndex);
  const payloadTotalCount = toCount(payload.totalCount);
  const payloadProcessedCount = toCount(payload.processedCount);
  const payloadCreatedCount = toCount(payload.createdCount);
  const payloadFailedCount = toCount(payload.failedCount);
  const payloadMessage = String(payload.message ?? '').trim();
  const payloadStageIds = Array.isArray(payload.stageIds)
    ? payload.stageIds.map((id) => String(id)).filter(Boolean)
    : [];
  const exhibitId = payload.exhibitId != null && String(payload.exhibitId).trim()
    ? String(payload.exhibitId)
    : null;
  const exhibitName = payload.exhibitName != null && String(payload.exhibitName).trim()
    ? String(payload.exhibitName)
    : null;

  const previous = buildProgress.value;
  const sameRun = Boolean(
    previous
    && previous.runId === runId
    && previous.routeId === routeId,
  );

  let batchBase = {
    totalCount: 0,
    processedCount: 0,
    createdCount: 0,
    failedCount: 0,
  };

  if (sameRun && previous) {
    if (isNewBuildBatch(previous, {
      interactionType,
      status,
      currentIndex: payloadCurrentIndex,
      createdCount: payloadCreatedCount,
      processedCount: payloadProcessedCount,
    })) {
      // 新批次：把上一批累计值固化为基数
      batchBase = {
        totalCount: previous.totalCount,
        processedCount: previous.processedCount,
        createdCount: previous.createdCount,
        failedCount: previous.failedCount,
      };
    } else {
      batchBase = previous.batchBase;
    }
  }

  const mergedStageIds = uniqueStageIds([
    ...(sameRun && previous ? previous.stageIds : []),
    ...payloadStageIds,
  ]);

  // 本批绝对计数 + 历史基数；stageIds 去重后作为创建数下限，避免多批 completed 只带 1 时回退。
  const createdCount = Math.max(
    batchBase.createdCount + payloadCreatedCount,
    mergedStageIds.length,
  );
  const processedCount = Math.max(
    batchBase.processedCount + payloadProcessedCount,
    createdCount,
  );
  const totalCount = Math.max(
    batchBase.totalCount + payloadTotalCount,
    processedCount,
    createdCount,
  );
  const failedCount = batchBase.failedCount + payloadFailedCount;

  buildProgress.value = {
    runId,
    routeId,
    interactionType,
    currentIndex: payloadCurrentIndex,
    totalCount,
    processedCount,
    createdCount,
    failedCount,
    exhibitId: exhibitId ?? (sameRun ? previous?.exhibitId ?? null : null),
    exhibitName: exhibitName ?? (sameRun ? previous?.exhibitName ?? null : null),
    status,
    stageIds: mergedStageIds,
    batchBase,
    message: resolveProgressMessage({
      status,
      currentIndex: payloadCurrentIndex,
      totalCount,
      createdCount,
      exhibitName: exhibitName ?? (sameRun ? previous?.exhibitName ?? null : null),
      payloadMessage,
    }),
  };

  if (!routeId) {
    return;
  }

  if (status === 'succeeded') {
    scheduleStageRefresh(routeId);
    return;
  }

  if (status === 'completed' || status === 'failed') {
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
    // 与 ui.route.*.updated 同路径：完整 SSE 结束至少刷一次列表/预览
    // useChatSession 已把 contextRouteId 回填进 payload.routeId
    const routeId = String(payload.routeId || routeDetail.value?.id || '').trim();

    if (routeId) {
      emit('routeChanged', routeId);
    }
  },
});

const resetSession = () => {
  clearBuildProgress();
  resetChatSession();
};

// active 仅表示是否在前台展示，切 tab 不中断 SSE；关闭 dialog 由父级 abortActiveRun

// 新一轮对话开始时清掉上一批进度，避免残留。
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
      empty-description="例如：帮我创建一条关于宋代瓷器的讲解路线，覆盖 6 到 8 个展品节点。"
      placeholder="描述主题、受众、节点数量或讲解风格…"
      @send="sendMessage"
      @cancel="cancelRun"
      @retry="retryLastFailed"
      @suggestion="sendMessage">
      <template #aside>
        <RouteChatPreviewPane
          :route-detail="routeDetail"
          :exhibits="exhibits"
          :build-progress="buildProgress"
          :context-route-id="contextRouteId"
          :published-hint="publishedHint" />
      </template>
    </ChatPanel>
  </div>
</template>
