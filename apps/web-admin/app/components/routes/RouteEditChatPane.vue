<script setup lang="ts">
import { computed, watch } from 'vue';
import ChatContextChips, {
  type ChatContextChip
} from '@/components/chat/ChatContextChips.vue';
import ChatComposer from '@/components/chat/ChatComposer.vue';
import ChatMessageList from '@/components/chat/ChatMessageList.vue';
import { useChatSession } from '@/composables/useChatSession';
import type {
  ChatAttachmentReference,
  ChatComposerSubmitPayload,
  ChatEventResponse,
} from '@/types/chat';

interface Props {
  active?: boolean;
  routeId: string;
  routeLabel: string;
  stageId?: string;
  stageLabel?: string;
  referencedAttachments?: ChatAttachmentReference[];
}

const props = withDefaults(defineProps<Props>(), {
  active: true,
  stageId: '',
  stageLabel: '',
  referencedAttachments: () => [],
});

const emit = defineEmits<{
  clearStage: [];
  /** SSE 触发的静默 detail 刷新（节流由父级处理） */
  requestDetailRefresh: [routeId: string];
  /** run 结束时立即再刷一次 */
  flushDetailRefresh: [routeId: string];
  removeReference: [attachmentId: string];
  referencesConsumed: [attachmentIds: string[]];
}>();

const buildOutboundMessage = (
  userText: string,
  routeId: string,
  stageId?: string
) => {
  const lines = ['【上下文】', `routeId: ${routeId}`];

  if (stageId) {
    lines.push(`stageId: ${stageId}`);
  }

  lines.push('', '【用户指令】', userText);
  return lines.join('\n');
};

const shouldRefreshFromEvent = (event: ChatEventResponse) => {
  if (
    event.type !== 'ui.route.build.progress' &&
    event.type !== 'ui.route.stage.updated'
  ) {
    return false;
  }

  const payload = (event.payload ?? {}) as { routeId?: string | null };
  const eventRouteId = String(payload.routeId ?? '').trim();
  const currentRouteId = String(props.routeId || '').trim();

  if (!currentRouteId) {
    return false;
  }

  // 无 routeId 时保守刷新当前编辑路线；有 routeId 则必须匹配。
  return !eventRouteId || eventRouteId === currentRouteId;
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
  abortActiveRun
} = useChatSession({
  contextRouteId: props.routeId,
  onEvent: (event) => {
    if (!shouldRefreshFromEvent(event)) {
      return;
    }

    const payload = (event.payload ?? {}) as { routeId?: string | null };
    const eventRouteId = String(payload.routeId ?? props.routeId ?? '').trim();

    if (eventRouteId) {
      emit('requestDetailRefresh', eventRouteId);
    }
  },
  onDone: (payload) => {
    // 与 stage.updated 同路径：done 时强制详情刷新，保证完整 SSE 至少一次 UI 更新
    // useChatSession 已尽量把 routeId 写进 payload
    const doneRouteId = String(payload.routeId || props.routeId || '').trim();

    if (doneRouteId) {
      emit('flushDetailRefresh', doneRouteId);
    }
  },
  onError: () => {
    const currentRouteId = String(props.routeId || '').trim();

    if (currentRouteId) {
      emit('flushDetailRefresh', currentRouteId);
    }
  }
});

const contextChips = computed<ChatContextChip[]>(() => {
  const chips: ChatContextChip[] = [];
  const routeId = String(props.routeId || '').trim();

  if (routeId) {
    chips.push({
      kind: 'route',
      id: routeId,
      label: props.routeLabel || routeId,
      removable: false
    });
  }

  const stageId = String(props.stageId || '').trim();

  if (stageId) {
    chips.push({
      kind: 'stage',
      id: stageId,
      label: props.stageLabel || stageId,
      removable: true
    });
  }

  return chips;
});

const canSend = computed(() => Boolean(String(props.routeId || '').trim()));

const sendTextMessage = async (
  userText: string,
  attachmentFiles: File[] = [],
  attachmentIds = props.referencedAttachments.map((item) => item.attachmentId),
  attachmentReferences = props.referencedAttachments,
) => {
  const routeId = String(props.routeId || '').trim();

  if (!routeId) {
    return;
  }

  const stageId = String(props.stageId || '').trim() || undefined;
  const wireMessage = buildOutboundMessage(userText, routeId, stageId);

  const sent = await sendMessage(userText, {
    wireMessage,
    attachmentFiles,
    attachmentIds,
    attachmentReferences,
  });
  if (sent && attachmentIds.length) {
    emit('referencesConsumed', attachmentIds);
  }
};

const handleSend = (payload: ChatComposerSubmitPayload) =>
  sendTextMessage(
    payload.message,
    payload.images,
    payload.attachmentIds,
    payload.attachmentReferences,
  );

const handleRemoveChip = (chip: ChatContextChip) => {
  if (chip.kind === 'stage') {
    emit('clearStage');
  }
};

watch(
  () => props.routeId,
  (next, prev) => {
    const nextId = String(next || '').trim();
    contextRouteId.value = nextId;

    // 切换路线时重置会话；首轮挂载 prev 为 undefined，不 reset
    if (prev !== undefined && String(prev || '').trim() !== nextId) {
      resetSession();
      contextRouteId.value = nextId;
    }
  },
  { immediate: true }
);

// active 仅表示是否在前台展示，切 tab / 失焦不中断 SSE；关闭 dialog 由父级 abort

defineExpose({
  resetSession,
  abortActiveRun
});
</script>

<template>
  <div class="chat-shell flex min-h-0 flex-1 flex-col overflow-hidden">
    <ChatMessageList
      :messages="messages"
      :tools="activeTools"
      :is-running="isRunning"
      empty-title="用对话编辑当前路线"
      empty-description="例如：给当前站点增加提示，或按主题补几个站点。"
      @retry="retryLastFailed"
      @suggestion="sendTextMessage" />

    <div v-if="errorMessage" class="chat-error">
      {{ errorMessage }}
    </div>

    <ChatContextChips :chips="contextChips" @remove="handleRemoveChip" />

    <ChatComposer
      :sending="isRunning"
      :disabled="!canSend"
      :referenced-attachments="props.referencedAttachments"
      placeholder="描述你想对当前路线或站点做的修改…"
      @send="handleSend"
      @remove-reference="emit('removeReference', $event)"
      @cancel="cancelRun" />
  </div>
</template>

<style scoped>
.chat-shell {
  border-radius: 0.95rem;
  border: 1px solid rgba(209, 178, 111, 0.12);
  background:
    linear-gradient(180deg, rgba(209, 178, 111, 0.04), transparent 18%),
    rgba(12, 13, 16, 0.94);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.025),
    0 12px 28px rgba(0, 0, 0, 0.16);
}

.chat-error {
  margin: 0 0.75rem;
  border-radius: 0.55rem;
  border: 1px solid rgba(239, 68, 68, 0.25);
  background: rgba(239, 68, 68, 0.08);
  padding: 0.4rem 0.65rem;
  font-size: 12px;
  color: hsl(var(--destructive));
}
</style>
