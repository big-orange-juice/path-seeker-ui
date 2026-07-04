<script setup lang="ts">
import { Background } from '@vue-flow/background';
import { Controls } from '@vue-flow/controls';
import { VueFlow, type Edge, type Node } from '@vue-flow/core';
import { GameplayPreviewHost, getInteractionTypeMeta, type GameplayPreviewStage } from '@path-seeker/game-renderer';
import { computed, shallowRef, watch } from 'vue';
import Button from '@/components/shadcn/button/Button.vue';
import Dialog from '@/components/shadcn/dialog/Dialog.vue';
import DialogContent from '@/components/shadcn/dialog/DialogContent.vue';
import DialogDescription from '@/components/shadcn/dialog/DialogDescription.vue';
import DialogHeader from '@/components/shadcn/dialog/DialogHeader.vue';
import DialogTitle from '@/components/shadcn/dialog/DialogTitle.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import type { RouteDetailResponse, RouteNodeResponse } from '@/types/route';
import '@vue-flow/core/dist/style.css';
import '@vue-flow/core/dist/theme-default.css';
import '@vue-flow/controls/dist/style.css';

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
  refresh: [];
}>();

const selectedStageId = shallowRef('');

const isOpen = computed({
  get: () => props.open,
  set: (value: boolean) => emit('update:open', value),
});

const sortedNodes = computed(() =>
  [...(props.detail?.nodes ?? [])].sort((left, right) => {
    const leftOrder = left.sortOrder || left.stageNo || 0;
    const rightOrder = right.sortOrder || right.stageNo || 0;
    return leftOrder - rightOrder;
  })
);

const selectedNode = computed(() =>
  sortedNodes.value.find((node) => node.stageId === selectedStageId.value) ?? sortedNodes.value[0] ?? null
);

const flowNodes = computed<Node[]>(() =>
  sortedNodes.value.map((node, index) => ({
    id: node.stageId || `stage-${index + 1}`,
    type: 'default',
    position: {
      x: index * 230,
      y: index % 2 === 0 ? 40 : 150,
    },
    data: {
      label: `${node.stageNo || index + 1}. ${node.title || '未命名节点'}\n${getInteractionTypeName(node.interactionType)}`,
    },
    class: node.stageId === selectedStageId.value ? 'is-selected-route-node' : '',
  }))
);

const flowEdges = computed<Edge[]>(() =>
  flowNodes.value.slice(1).map((node, index) => ({
    id: `${flowNodes.value[index]?.id}-${node.id}`,
    source: flowNodes.value[index]?.id ?? '',
    target: node.id,
    animated: true,
  }))
);

const previewStage = computed<GameplayPreviewStage | null>(() => {
  const node = selectedNode.value;
  if (!node) {
    return null;
  }

  return {
    stageId: node.stageId || '',
    interactionType: node.interactionType || 0,
    title: node.title || '未命名节点',
    subtitle: node.subtitle,
    exhibitName: node.exhibitName,
    galleryName: node.galleryName,
    score: node.score,
    config: parseNodeConfig(node),
  };
});

const routeTitle = computed(() => props.detail?.route?.title || '路线详情');
const routeMeta = computed(() => {
  const route = props.detail?.route;
  if (!route) {
    return '暂无路线基础信息';
  }

  return `${route.puzzleCount || sortedNodes.value.length || 0} 个节点 · ${route.totalScore || 0} 分`;
});

watch(
  sortedNodes,
  (nodes) => {
    if (!nodes.length) {
      selectedStageId.value = '';
      return;
    }

    if (nodes.some((node) => node.stageId === selectedStageId.value)) {
      return;
    }

    selectedStageId.value = nodes[0]?.stageId || '';
  },
  { immediate: true }
);

function parseNodeConfig(node: RouteNodeResponse): Record<string, unknown> {
  if (!node.config) {
    return {};
  }

  try {
    const parsed = JSON.parse(node.config) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function selectFlowNode(event: { node: Node }) {
  selectedStageId.value = String(event.node.id);
}

function selectListNode(node: RouteNodeResponse) {
  selectedStageId.value = node.stageId || '';
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
            <DialogTitle class="truncate">{{ routeTitle }}</DialogTitle>
            <DialogDescription>{{ routeMeta }}</DialogDescription>
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

      <div v-if="props.pending" class="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        正在加载路线详情...
      </div>

      <div v-else class="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_390px] gap-4 overflow-hidden px-5 py-4">
        <section class="flex min-h-0 flex-col gap-3">
          <div class="h-[330px] overflow-hidden rounded-xl border border-border/70 bg-background/70">
            <VueFlow
              :nodes="flowNodes"
              :edges="flowEdges"
              fit-view-on-init
              class="route-flow"
              @node-click="selectFlowNode">
              <Background />
              <Controls />
            </VueFlow>
          </div>

          <div class="min-h-0 flex-1 overflow-y-auto rounded-xl border border-border/70">
            <button
              v-for="node in sortedNodes"
              :key="node.stageId || node.sortOrder"
              type="button"
              class="flex w-full items-center justify-between gap-3 border-b border-border/60 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-accent/50"
              :class="node.stageId === selectedNode?.stageId ? 'bg-accent/60' : ''"
              @click="selectListNode(node)">
              <div class="min-w-0">
                <div class="flex min-w-0 items-center gap-2">
                  <p class="truncate text-sm font-medium text-foreground">{{ node.title || '未命名节点' }}</p>
                  <span class="shrink-0 rounded-full bg-sky-500/10 px-2 py-0.5 text-[11px] text-sky-200">
                    {{ getInteractionTypeName(node.interactionType) }}
                  </span>
                </div>
                <p class="mt-1 truncate text-xs text-muted-foreground">
                  {{ node.exhibitName || '未关联展品' }}<span v-if="node.galleryName"> · {{ node.galleryName }}</span>
                </p>
              </div>
              <span class="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                {{ node.score || 0 }} 分
              </span>
            </button>

            <div v-if="!sortedNodes.length" class="flex h-32 items-center justify-center text-sm text-muted-foreground">
              当前路线暂无节点。
            </div>
          </div>
        </section>

        <aside class="min-h-0 overflow-y-auto">
          <GameplayPreviewHost :stage="previewStage" />
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
  max-width: 190px;
  border-radius: 12px;
  border-color: hsl(var(--border));
  background: hsl(var(--card));
  color: hsl(var(--foreground));
  font-size: 12px;
}

:deep(.vue-flow__node.is-selected-route-node) {
  border-color: rgb(209 178 111 / 70%);
  box-shadow: 0 0 0 2px rgb(209 178 111 / 18%);
}

:deep(.vue-flow__edge-path) {
  stroke: rgb(209 178 111 / 60%);
}
</style>
