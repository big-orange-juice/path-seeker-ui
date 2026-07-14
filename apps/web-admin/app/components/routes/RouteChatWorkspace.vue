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

      if (routeId) {
        emit('routeChanged', routeId);
      }

      break;
    }

    case 'ui.route.detail.updated': {
      const payload = (event.payload ?? {}) as ChatRouteDetailPayload;
      routeDetail.value = {
        ...payload,
        id: payload.id != null ? String(payload.id) : null,
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

    case 'ui.route.build.complete': {
      const payload = event.payload as ChatRouteBuildCompletePayload;
      const routeId = String(payload?.routeId ?? '').trim();

      if (routeId) {
        emit('routeChanged', routeId);

        if (payload?.published) {
          publishedHint.value = '路线已发布';
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
  resetSession,
  abortActiveRun,
} = useChatSession({
  onEvent: handleUiEvent,
  onDone: (payload: ChatDonePayload) => {
    if (payload.routeId) {
      emit('routeChanged', String(payload.routeId));
    }
  },
});

watch(
  () => props.active,
  (active) => {
    if (!active) {
      abortActiveRun();
    }
  },
);

onBeforeUnmount(() => {
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
      @retry="retryLastFailed">
      <template #aside>
        <RouteChatPreviewPane
          :route-detail="routeDetail"
          :exhibits="exhibits"
          :context-route-id="contextRouteId"
          :published-hint="publishedHint" />
      </template>
    </ChatPanel>
  </div>
</template>
