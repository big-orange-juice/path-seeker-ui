<script setup lang="ts">
import { Background } from '@vue-flow/background';
import { Controls } from '@vue-flow/controls';
import { Position, VueFlow, type Edge, type Node } from '@vue-flow/core';
import {
  GameplayPreviewHost,
  getInteractionTypeMeta,
  type GameplayPreviewNarration,
  type GameplayPreviewNarrationStatus,
  type GameplayPreviewStage,
} from '@path-seeker/game-renderer';
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue';
import Button from '@/components/shadcn/button/Button.vue';
import Dialog from '@/components/shadcn/dialog/Dialog.vue';
import DialogContent from '@/components/shadcn/dialog/DialogContent.vue';
import DialogDescription from '@/components/shadcn/dialog/DialogDescription.vue';
import DialogHeader from '@/components/shadcn/dialog/DialogHeader.vue';
import DialogTitle from '@/components/shadcn/dialog/DialogTitle.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import RouteEditChatPane from '@/components/routes/RouteEditChatPane.vue';
import type { NarrationDetailResponse } from '@/types/narration';
import type { RouteDetailResponse, RouteNodeResponse } from '@/types/route';
import '@vue-flow/core/dist/style.css';
import '@vue-flow/core/dist/theme-default.css';
import '@vue-flow/controls/dist/style.css';

type RightPaneTab = 'chat' | 'preview';

interface Props {
  open: boolean;
  detail: RouteDetailResponse | null;
  pending?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  pending: false,
});

const emit = defineEmits<{
  'update:open': [value: boolean];
  /** 手动刷新（可带 loading） */
  refresh: [];
  /** SSE 驱动的静默刷新，不遮挡 workflow */
  'refresh-silent': [];
}>();

const { request } = useApiClient();

const selectedStageId = shallowRef('');
const rightPane = ref<RightPaneTab>('chat');
const chatPaneRef = shallowRef<{ resetSession: () => void; abortActiveRun: () => void } | null>(null);
const narrationDetail = shallowRef<NarrationDetailResponse | null>(null);
const narrationStatus = ref<GameplayPreviewNarrationStatus>('idle');
const narrationErrorMessage = ref('');

let detailRefreshTimer: ReturnType<typeof setTimeout> | null = null;
let pendingSilentRefresh = false;
let narrationRequestSeq = 0;

const isOpen = computed({
  get: () => props.open,
  set: (value: boolean) => emit('update:open', value),
});

const sortedNodes = computed(() =>
  [...(props.detail?.nodes ?? [])].sort((left, right) => {
    const leftOrder = left.sortOrder || left.stageNo || 0;
    const rightOrder = right.sortOrder || right.stageNo || 0;
    return leftOrder - rightOrder;
  }),
);

const selectedNode = computed(() =>
  sortedNodes.value.find((node) => node.stageId === selectedStageId.value) ?? null,
);

/** 预览：有选中用选中，否则回退第一个节点方便查看 */
const previewNode = computed(() => selectedNode.value ?? sortedNodes.value[0] ?? null);

/** 垂直串联：节点居中对齐，自上而下连接 */
const FLOW_NODE_X = 0;
const FLOW_NODE_GAP_Y = 130;

const flowNodes = computed<Node[]>(() =>
  sortedNodes.value.map((node, index) => ({
    id: node.stageId || `stage-${index + 1}`,
    type: 'default',
    position: {
      x: FLOW_NODE_X,
      y: index * FLOW_NODE_GAP_Y,
    },
    sourcePosition: Position.Bottom,
    targetPosition: Position.Top,
    data: {
      label: `${node.sortOrder || index + 1}. ${node.title || '未命名节点'}\n${getInteractionTypeName(node.interactionType)}`,
    },
    class: node.stageId && node.stageId === selectedStageId.value ? 'is-selected-route-node' : '',
  })),
);

const flowEdges = computed<Edge[]>(() =>
  flowNodes.value.slice(1).map((node, index) => ({
    id: `${flowNodes.value[index]?.id}-${node.id}`,
    source: flowNodes.value[index]?.id ?? '',
    target: node.id,
    type: 'smoothstep',
    animated: true,
  })),
);

const mapNarrationPreview = (detail: NarrationDetailResponse | null): GameplayPreviewNarration | null => {
  if (!detail) {
    return null;
  }

  return {
    narrationText: detail.narrationText != null ? String(detail.narrationText) : null,
    audioUrl: detail.audioUrl != null ? String(detail.audioUrl) : null,
    guideId: detail.guideId != null ? String(detail.guideId) : null,
    guideName: detail.guideName != null ? String(detail.guideName) : null,
    resolvedStyle: detail.resolvedStyle != null ? String(detail.resolvedStyle) : null,
    durationMs: typeof detail.durationMs === 'number' ? detail.durationMs : null,
    textStatus: typeof detail.textStatus === 'number' ? detail.textStatus : null,
    audioStatus: typeof detail.audioStatus === 'number' ? detail.audioStatus : null,
    textError: detail.textError != null ? String(detail.textError) : null,
  };
};

const previewStage = computed<GameplayPreviewStage | null>(() => {
  const node = previewNode.value;
  if (!node) {
    return null;
  }

  const interactionType = node.interactionType || 0;
  const isNarration = interactionType === 11;

  return {
    stageId: node.stageId || '',
    interactionType,
    title: node.title || '未命名节点',
    subtitle: node.subtitle,
    exhibitName: node.exhibitName,
    galleryName: node.galleryName,
    score: node.score,
    config: parseNodeConfig(node),
    narration: isNarration ? mapNarrationPreview(narrationDetail.value) : null,
    narrationStatus: isNarration ? narrationStatus.value : 'idle',
    narrationErrorMessage: isNarration ? narrationErrorMessage.value : null,
  };
});

const resolveRequestErrorMessage = (error: unknown, fallback: string) => {
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

const loadNarrationDetail = async (stageId: string) => {
  const requestId = ++narrationRequestSeq;
  narrationStatus.value = 'loading';
  narrationErrorMessage.value = '';
  narrationDetail.value = null;

  try {
    const detail = await request<NarrationDetailResponse | null>('/api/narration/detail', {
      method: 'GET',
      query: {
        stageId,
      },
    });

    if (requestId !== narrationRequestSeq) {
      return;
    }

    narrationDetail.value = detail;
    narrationStatus.value = 'ready';

    if (!detail?.narrationText && detail?.textError) {
      narrationErrorMessage.value = String(detail.textError);
    }
  } catch (error) {
    if (requestId !== narrationRequestSeq) {
      return;
    }

    narrationDetail.value = null;
    narrationStatus.value = 'error';
    narrationErrorMessage.value = resolveRequestErrorMessage(error, '解说词加载失败。');
  }
};

watch(
  () => {
    const node = previewNode.value;
    return {
      open: props.open,
      tab: rightPane.value,
      stageId: node?.stageId ? String(node.stageId) : '',
      interactionType: node?.interactionType ?? 0,
      // 静默刷新 detail 后重拉解说（Agent 可能刚生成文本）
      detailStamp: `${props.detail?.route?.id || ''}:${props.detail?.nodes?.length ?? 0}`,
    };
  },
  (state) => {
    if (!state.open || state.tab !== 'preview' || state.interactionType !== 11 || !state.stageId) {
      narrationRequestSeq += 1;
      narrationDetail.value = null;
      narrationStatus.value = 'idle';
      narrationErrorMessage.value = '';
      return;
    }

    void loadNarrationDetail(state.stageId);
  },
  { immediate: true },
);

const routeId = computed(() => String(props.detail?.route?.id ?? '').trim());
const routeTitle = computed(() => props.detail?.route?.title || '路线详情');
const routeMeta = computed(() => {
  const route = props.detail?.route;
  if (!route) {
    return '暂无路线基础信息';
  }

  return `${route.puzzleCount || sortedNodes.value.length || 0} 个节点 · ${route.totalScore || 0} 分`;
});

const stageAttachmentLabel = computed(() => {
  const node = selectedNode.value;
  if (!node) {
    return '';
  }

  const order = node.sortOrder
    || sortedNodes.value.findIndex((item) => item.stageId === node.stageId) + 1;
  const title = node.title || '未命名节点';
  return `${order}. ${title}`;
});

const clearDetailRefreshTimer = () => {
  if (detailRefreshTimer) {
    clearTimeout(detailRefreshTimer);
    detailRefreshTimer = null;
  }
};

const scheduleSilentDetailRefresh = () => {
  pendingSilentRefresh = true;
  clearDetailRefreshTimer();
  detailRefreshTimer = setTimeout(() => {
    detailRefreshTimer = null;
    if (!pendingSilentRefresh) {
      return;
    }

    pendingSilentRefresh = false;
    emit('refresh-silent');
  }, 2000);
};

const flushSilentDetailRefresh = () => {
  clearDetailRefreshTimer();
  pendingSilentRefresh = false;
  emit('refresh-silent');
};

const handleRequestDetailRefresh = (eventRouteId: string) => {
  const currentId = routeId.value;
  const nextId = String(eventRouteId || '').trim();

  if (!currentId || (nextId && nextId !== currentId)) {
    return;
  }

  scheduleSilentDetailRefresh();
};

const handleFlushDetailRefresh = (eventRouteId: string) => {
  const currentId = routeId.value;
  const nextId = String(eventRouteId || '').trim();

  if (!currentId || (nextId && nextId !== currentId)) {
    return;
  }

  flushSilentDetailRefresh();
};

watch(
  sortedNodes,
  (nodes) => {
    if (!selectedStageId.value) {
      return;
    }

    if (!nodes.some((node) => node.stageId === selectedStageId.value)) {
      selectedStageId.value = '';
    }
  },
  { immediate: true },
);

watch(
  () => props.open,
  (open) => {
    if (open) {
      rightPane.value = 'chat';
      return;
    }

    clearDetailRefreshTimer();
    pendingSilentRefresh = false;
    selectedStageId.value = '';
    chatPaneRef.value?.abortActiveRun();
    chatPaneRef.value?.resetSession();
  },
);

watch(routeId, (next, prev) => {
  if (prev && next && prev !== next) {
    selectedStageId.value = '';
    chatPaneRef.value?.resetSession();
  }
});

onBeforeUnmount(() => {
  clearDetailRefreshTimer();
  chatPaneRef.value?.abortActiveRun();
});

function parseNodeConfig(node: RouteNodeResponse): Record<string, unknown> {
  if (!node.config) {
    return {};
  }

  try {
    const parsed = JSON.parse(node.config) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

function selectFlowNode(event: { node: Node }) {
  // 仅用户点击 workflow 节点时挂上 stage 附件；不自动切预览 tab
  selectedStageId.value = String(event.node.id || '').trim();
}

function clearStageAttachment() {
  selectedStageId.value = '';
}

function getInteractionTypeName(interactionType: number) {
  return getInteractionTypeMeta(interactionType)?.label || `未知玩法 ${interactionType}`;
}

function closeDialog() {
  isOpen.value = false;
}
</script>

<template>
  <Dialog v-model:open="isOpen">
    <DialogContent class="flex h-[92vh] max-w-[1320px] flex-col overflow-hidden">
      <DialogHeader class="border-b border-border/70 px-5 py-4">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <DialogTitle class="truncate">
              {{ routeTitle }}
            </DialogTitle>
            <DialogDescription>
              {{ routeMeta }}
            </DialogDescription>
          </div>
          <div class="flex shrink-0 items-center gap-2">
            <Button variant="outline" size="sm" :disabled="props.pending" @click="emit('refresh')">
              <AppIcon name="refresh-cw" class="h-3.5 w-3.5" />
              刷新
            </Button>
            <Button variant="ghost" size="icon" title="关闭详情" @click="closeDialog">
              <AppIcon name="x" class="h-4 w-4" />
            </Button>
          </div>
        </div>
      </DialogHeader>

      <div v-if="props.pending && !props.detail" class="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        正在加载路线详情...
      </div>

      <div v-else class="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_400px] gap-4 overflow-hidden px-5 py-4">
        <section class="flex min-h-0 min-w-0 flex-col">
          <div class="relative min-h-0 flex-1 overflow-hidden rounded-xl border border-border/70 bg-background/70">
            <VueFlow
              :nodes="flowNodes"
              :edges="flowEdges"
              fit-view-on-init
              :fit-view-options="{ padding: 0.28, includeHiddenNodes: false }"
              :min-zoom="0.35"
              :max-zoom="1.6"
              class="route-flow h-full"
              @node-click="selectFlowNode">
              <Background />
              <Controls />
            </VueFlow>
            <p
              v-if="!sortedNodes.length"
              class="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
              当前路线暂无节点
            </p>
          </div>
        </section>

        <aside class="flex min-h-0 min-w-0 flex-col gap-3">
          <div class="flex shrink-0 rounded-lg border border-border/70 bg-muted/30 p-0.5">
            <button
              type="button"
              class="flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors"
              :class="rightPane === 'chat'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'"
              @click="rightPane = 'chat'">
              对话
            </button>
            <button
              type="button"
              class="flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors"
              :class="rightPane === 'preview'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'"
              @click="rightPane = 'preview'">
              预览
            </button>
          </div>

          <div class="min-h-0 flex-1 overflow-hidden">
            <RouteEditChatPane
              v-show="rightPane === 'chat'"
              ref="chatPaneRef"
              class="h-full"
              :active="props.open"
              :route-id="routeId"
              :route-label="routeTitle"
              :stage-id="selectedStageId"
              :stage-label="stageAttachmentLabel"
              @clear-stage="clearStageAttachment"
              @request-detail-refresh="handleRequestDetailRefresh"
              @flush-detail-refresh="handleFlushDetailRefresh" />

            <div
              v-show="rightPane === 'preview'"
              class="h-full min-h-0 overflow-y-auto rounded-xl border border-border/70">
              <GameplayPreviewHost v-if="previewStage" :stage="previewStage" />
              <div v-else class="flex h-full items-center justify-center px-4 text-sm text-muted-foreground">
                暂无节点可预览
              </div>
            </div>
          </div>
        </aside>
      </div>
    </DialogContent>
  </Dialog>
</template>

<style scoped>
.route-flow {
  --vf-node-bg: hsl(var(--background));
  --vf-node-text: hsl(var(--foreground));
  --vf-node-color: hsl(var(--foreground));
  --vf-node-border: hsl(var(--border));
  --vf-handle: hsl(var(--muted-foreground));
}

:deep(.vue-flow__node) {
  width: 200px;
  max-width: 200px;
  border-radius: 12px;
  border-color: hsl(var(--border));
  background: hsl(var(--card));
  color: hsl(var(--foreground));
  font-size: 12px;
  text-align: center;
}

:deep(.vue-flow__node.is-selected-route-node) {
  border-color: rgb(209 178 111 / 70%);
  box-shadow: 0 0 0 2px rgb(209 178 111 / 18%);
}

:deep(.vue-flow__edge-path) {
  stroke: rgb(209 178 111 / 60%);
}
</style>
