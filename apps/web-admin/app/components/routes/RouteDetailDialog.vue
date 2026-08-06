<script setup lang="ts">
import { Background } from '@vue-flow/background';
import { Controls } from '@vue-flow/controls';
import { Position, VueFlow, type Edge, type Node } from '@vue-flow/core';
import { Check, Pencil, Trash2, X } from 'lucide-vue-next';
import {
  getInteractionTypeMeta,
  // INTERACTION_TYPE_META, // 新增站点暂关
  parseStageConfig,
  // SUPPORTED_INTERACTION_TYPES, // 新增站点暂关
  type GameplayPreviewNarration,
  type GameplayPreviewNarrationStatus,
  type GameplayPreviewStage,
  type StageExhibitLocationMap,
} from '@path-seeker/game-renderer';
import { computed, onBeforeUnmount, shallowRef, watch } from 'vue';
import Button from '@/components/shadcn/button/Button.vue';
import Dialog from '@/components/shadcn/dialog/Dialog.vue';
import DialogContent from '@/components/shadcn/dialog/DialogContent.vue';
import DialogDescription from '@/components/shadcn/dialog/DialogDescription.vue';
import DialogFooter from '@/components/shadcn/dialog/DialogFooter.vue';
import DialogHeader from '@/components/shadcn/dialog/DialogHeader.vue';
import DialogTitle from '@/components/shadcn/dialog/DialogTitle.vue';
import Input from '@/components/shadcn/input/Input.vue';
import AdminStageSimulator from '@/components/routes/AdminStageSimulator.vue';
import RouteEditChatPane from '@/components/routes/RouteEditChatPane.vue';
import StageEditDialog from '@/components/routes/StageEditDialog.vue';
import { useActionFeedback } from '@/composables/useActionFeedback';
import type { RouteWorkflowActions } from '@/constants/routeWorkflow';
import type { NarrationDetailResponse } from '@/types/narration';
import type {
  // CreateRouteStagePayload, // 新增站点暂关
  DeleteRouteStagePayload,
  RouteDetailResponse,
  RouteNodeResponse,
  RouteRecord,
  UpdateRouteTitlePayload,
} from '@/types/route';
import RouteStatusBadge from '@/components/routes/RouteStatusBadge.vue';
import { resolveExhibitLocationMap } from '@/utils/resolveExhibitLocationMap';
import '@vue-flow/core/dist/style.css';
import '@vue-flow/core/dist/theme-default.css';
import '@vue-flow/controls/dist/style.css';

interface Props {
  open: boolean;
  detail: RouteDetailResponse | null;
  record?: RouteRecord | null;
  pending?: boolean;
  canEdit?: boolean;
  lockMessage?: string;
  actions?: RouteWorkflowActions | null;
}

const props = withDefaults(defineProps<Props>(), {
  pending: false,
  record: null,
  canEdit: true,
  lockMessage: '',
  actions: null,
});

const emit = defineEmits<{
  'update:open': [value: boolean];
  'refresh-silent': [];
  publish: [];
  unpublish: [];
  submitAudit: [];
  audit: [];
  'title-saved': [title: string];
}>();

const { request } = useApiClient();
const actionFeedback = useActionFeedback();
const selectedStageId = shallowRef('');
const stageEditOpen = shallowRef(false);
// 新增站点暂关
// const stageCreateOpen = shallowRef(false);
// const creatingStage = shallowRef(false);
// const createTitleDraft = shallowRef('');
// const createInteractionType = shallowRef('1');
// const createError = shallowRef('');
const stageDeleteOpen = shallowRef(false);
const deletingStage = shallowRef(false);
const pendingDeleteStageId = shallowRef('');
const pendingDeleteStageLabel = shallowRef('');
const chatPaneRef = shallowRef<{
  resetSession: () => void;
  abortActiveRun: () => void;
} | null>(null);
const narrationDetail = shallowRef<NarrationDetailResponse | null>(null);
const narrationStatus = shallowRef<GameplayPreviewNarrationStatus>('idle');
const narrationErrorMessage = shallowRef('');
const exhibitLocation = shallowRef<StageExhibitLocationMap | null>(null);
const editingRouteTitle = shallowRef(false);
const routeTitleDraft = shallowRef('');
const savingRouteTitle = shallowRef(false);
const routeTitleError = shallowRef('');
let detailRefreshTimer: ReturnType<typeof setTimeout> | null = null;
let pendingSilentRefresh = false;
let narrationRequestSeq = 0;
let exhibitLocationRequestSeq = 0;

// 新增站点暂关
// const interactionTypeOptions = SUPPORTED_INTERACTION_TYPES.map((type) => ({
//   value: String(type),
//   label: INTERACTION_TYPE_META[type]?.label || `类型 ${type}`,
// }));

const isOpen = computed({
  get: () => props.open,
  set: (value: boolean) => emit('update:open', value),
});
// 新增站点暂关
// const stageCreateDialogOpen = computed({
//   get: () => stageCreateOpen.value,
//   set: (value: boolean) => {
//     if (!value) {
//       closeStageCreate();
//       return;
//     }
//     stageCreateOpen.value = true;
//   },
// });
const stageDeleteDialogOpen = computed({
  get: () => stageDeleteOpen.value,
  set: (value: boolean) => {
    if (!value) {
      closeStageDelete();
      return;
    }
    stageDeleteOpen.value = true;
  },
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
const previewNode = computed(() => selectedNode.value ?? sortedNodes.value[0] ?? null);

const FLOW_NODE_X = 0;
const FLOW_NODE_GAP_Y = 130;
const flowNodes = computed<Node[]>(() =>
  sortedNodes.value.map((node, index) => ({
    id: String(node.stageId || `stage-${index + 1}`),
    type: 'default',
    position: { x: FLOW_NODE_X, y: index * FLOW_NODE_GAP_Y },
    sourcePosition: Position.Bottom,
    targetPosition: Position.Top,
    data: {
      label: `${node.sortOrder || index + 1}. ${node.title || '未命名站点'}\n${getInteractionTypeName(node.interactionType)}`,
    },
    class: node.stageId === selectedStageId.value ? 'is-selected-route-node' : '',
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
  if (!detail) return null;
  const images = [...(detail.images ?? [])]
    .map((item) => ({
      id: item.id != null ? String(item.id) : null,
      imageUrl: item.imageUrl != null ? String(item.imageUrl) : null,
      sortOrder: typeof item.sortOrder === 'number' ? item.sortOrder : 0,
    }))
    .filter((item) => Boolean(item.imageUrl))
    .sort((left, right) => Number(left.sortOrder ?? 0) - Number(right.sortOrder ?? 0));
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
    images,
  };
};
const previewStage = computed<GameplayPreviewStage | null>(() => {
  const node = previewNode.value;
  if (!node) return null;
  const isNarration = node.interactionType === 11;
  return {
    stageId: String(node.stageId || ''),
    interactionType: node.interactionType || 0,
    title: node.title || '未命名站点',
    subtitle: node.subtitle,
    exhibitName: node.exhibitName,
    galleryName: node.galleryName,
    config: parseNodeConfig(node),
    narration: isNarration ? mapNarrationPreview(narrationDetail.value) : null,
    narrationStatus: isNarration ? narrationStatus.value : 'idle',
    narrationErrorMessage: isNarration ? narrationErrorMessage.value : null,
    exhibitLocation: exhibitLocation.value,
  };
});

const resolveRequestErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>;
    if (typeof record.statusMessage === 'string' && record.statusMessage) return record.statusMessage;
    if (typeof record.message === 'string' && record.message) return record.message;
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
      query: { stageId },
    });
    if (requestId !== narrationRequestSeq) return;
    narrationDetail.value = detail;
    narrationStatus.value = 'ready';
    if (!detail?.narrationText && detail?.textError) {
      narrationErrorMessage.value = String(detail.textError);
    }
  } catch (error) {
    if (requestId !== narrationRequestSeq) return;
    narrationStatus.value = 'error';
    narrationErrorMessage.value = resolveRequestErrorMessage(error, '解说词加载失败。');
  }
};
const narrationWatchKey = computed(() => {
  if (!props.open || previewNode.value?.interactionType !== 11) return '';
  return String(previewNode.value.stageId || '').trim();
});
watch(narrationWatchKey, (stageId) => {
  narrationRequestSeq += 1;
  narrationDetail.value = null;
  narrationStatus.value = 'idle';
  narrationErrorMessage.value = '';
  if (stageId) void loadNarrationDetail(stageId);
}, { immediate: true });

const exhibitLocationWatchKey = computed(() => {
  if (!props.open) return '';
  return String(previewNode.value?.refExhibitId || '').trim();
});
const loadExhibitLocation = async (refExhibitId: string) => {
  const requestId = ++exhibitLocationRequestSeq;
  exhibitLocation.value = null;
  try {
    const next = await resolveExhibitLocationMap(request, refExhibitId);
    if (requestId !== exhibitLocationRequestSeq) return;
    exhibitLocation.value = next;
  } catch {
    if (requestId !== exhibitLocationRequestSeq) return;
    exhibitLocation.value = null;
  }
};
watch(exhibitLocationWatchKey, (refExhibitId) => {
  exhibitLocationRequestSeq += 1;
  exhibitLocation.value = null;
  if (refExhibitId) void loadExhibitLocation(refExhibitId);
}, { immediate: true });

const routeId = computed(() => String(props.detail?.route?.id ?? '').trim());
const routeTitle = computed(() => props.detail?.route?.title || '路线详情');
const routeCode = computed(() => String(props.record?.routeCode || '').trim());
const routeMeta = computed(() => {
  const route = props.detail?.route;
  if (!route) {
    return '左侧点站点可预览中间效果；可编辑时右侧助手可协助改路线';
  }
  const count = route.puzzleCount || sortedNodes.value.length || 0;
  return `${count} 个站点 · 点左侧站点预览，右侧可让助手改路线`;
});
const stageAttachmentLabel = computed(() => {
  const node = selectedNode.value;
  if (!node) return '';
  const order = node.sortOrder || sortedNodes.value.findIndex((item) => item.stageId === node.stageId) + 1;
  return `${order}. ${node.title || '未命名站点'}`;
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
    if (!pendingSilentRefresh) return;
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
  const nextId = String(eventRouteId || '').trim();
  if (routeId.value && (!nextId || nextId === routeId.value)) scheduleSilentDetailRefresh();
};
const handleFlushDetailRefresh = (eventRouteId: string) => {
  const nextId = String(eventRouteId || '').trim();
  if (routeId.value && (!nextId || nextId === routeId.value)) flushSilentDetailRefresh();
};

watch(sortedNodes, (nodes) => {
  if (selectedStageId.value && !nodes.some((node) => node.stageId === selectedStageId.value)) selectedStageId.value = '';
}, { immediate: true });
watch(() => props.open, (open) => {
  if (open) return;
  clearDetailRefreshTimer();
  narrationRequestSeq += 1;
  selectedStageId.value = '';
  narrationDetail.value = null;
  narrationStatus.value = 'idle';
  narrationErrorMessage.value = '';
  chatPaneRef.value?.abortActiveRun();
  chatPaneRef.value?.resetSession();
});
watch(routeId, (next, previous) => {
  if (previous && next && previous !== next) {
    selectedStageId.value = '';
    chatPaneRef.value?.resetSession();
  }
});
onBeforeUnmount(() => {
  clearDetailRefreshTimer();
  chatPaneRef.value?.abortActiveRun();
});

function parseNodeConfig(node: RouteNodeResponse): Record<string, unknown> {
  return parseStageConfig(node.config) as Record<string, unknown>;
}
function selectFlowNode(event: { node: Node }) {
  selectedStageId.value = String(event.node.id || '').trim();
}
function openStageEditorFromNode(event: { node: Node }) {
  selectedStageId.value = String(event.node.id || '').trim();
  if (props.canEdit && selectedStageId.value) stageEditOpen.value = true;
}
function clearStageAttachment() {
  selectedStageId.value = '';
}
function openStageEditor() {
  if (props.canEdit && selectedNode.value) stageEditOpen.value = true;
}
function handleStageSaved() {
  flushSilentDetailRefresh();
}

/* 新增站点暂关 —— 恢复时一并解开模板「新增」按钮与弹窗
function nextStageOrder() {
  if (!sortedNodes.value.length) return 1;
  return Math.max(
    ...sortedNodes.value.map((node) => Number(node.sortOrder || node.stageNo || 0)),
  ) + 1;
}

function openStageCreate() {
  if (!props.canEdit || !routeId.value) return;
  createTitleDraft.value = '';
  createInteractionType.value = String(SUPPORTED_INTERACTION_TYPES[0] ?? 1);
  createError.value = '';
  stageCreateOpen.value = true;
}

function closeStageCreate() {
  if (creatingStage.value) return;
  stageCreateOpen.value = false;
  createError.value = '';
}

async function submitStageCreate() {
  const id = routeId.value;
  if (!id || !props.canEdit) {
    createError.value = '路线不可编辑，无法新增站点。';
    return;
  }

  const title = createTitleDraft.value.trim() || '未命名站点';
  const interactionType = Number(createInteractionType.value);
  if (!SUPPORTED_INTERACTION_TYPES.includes(interactionType as (typeof SUPPORTED_INTERACTION_TYPES)[number])) {
    createError.value = '请选择支持的玩法类型。';
    return;
  }

  const order = nextStageOrder();
  creatingStage.value = true;
  createError.value = '';
  try {
    const createdId = await request<string | null>('/api/route/stage-create', {
      method: 'POST',
      body: {
        routeId: id,
        stageNo: order,
        sortOrder: order,
        title,
        subtitle: null,
        interactionType,
        unlockRule: 1,
        isRequired: 1,
        score: 0,
        config: null,
        nextRule: null,
        refPuzzleId: null,
        refExhibitId: null,
      } satisfies CreateRouteStagePayload,
    });

    stageCreateOpen.value = false;
    const nextId = String(createdId ?? '').trim();
    if (nextId) selectedStageId.value = nextId;
    flushSilentDetailRefresh();
    actionFeedback.success('站点已新增。');
  } catch (error) {
    createError.value = resolveRequestErrorMessage(error, '新增站点失败。');
  } finally {
    creatingStage.value = false;
  }
}
*/

function openStageDelete() {
  if (!props.canEdit || !selectedNode.value || deletingStage.value) return;
  const stageId = String(selectedNode.value.stageId || '').trim();
  if (!stageId) return;

  const order = selectedNode.value.sortOrder
    || sortedNodes.value.findIndex((item) => item.stageId === stageId) + 1;
  const label = selectedNode.value.title || '未命名站点';
  pendingDeleteStageId.value = stageId;
  pendingDeleteStageLabel.value = `${order}. ${label}`;
  stageDeleteOpen.value = true;
}

function closeStageDelete() {
  if (deletingStage.value) return;
  stageDeleteOpen.value = false;
  pendingDeleteStageId.value = '';
  pendingDeleteStageLabel.value = '';
}

async function confirmStageDelete() {
  const stageId = pendingDeleteStageId.value.trim();
  if (!props.canEdit || !stageId) return;

  deletingStage.value = true;
  try {
    await request('/api/route/stage-delete', {
      method: 'POST',
      body: { id: stageId } satisfies DeleteRouteStagePayload,
    });
    if (selectedStageId.value === stageId) selectedStageId.value = '';
    stageDeleteOpen.value = false;
    pendingDeleteStageId.value = '';
    pendingDeleteStageLabel.value = '';
    flushSilentDetailRefresh();
    actionFeedback.success('站点已删除。');
  } catch (error) {
    actionFeedback.errorFrom(error, '删除站点失败。');
  } finally {
    deletingStage.value = false;
  }
}
/** 配图增删后立刻重拉解说 detail，模拟器封面同步 */
function handleNarrationPreviewRefresh() {
  const id = String(previewNode.value?.stageId || '').trim();
  if (id && previewNode.value?.interactionType === 11) {
    void loadNarrationDetail(id);
  }
}
function getInteractionTypeName(interactionType: number) {
  return getInteractionTypeMeta(interactionType)?.label || `未知玩法 ${interactionType}`;
}
function closeDialog() {
  isOpen.value = false;
}
function startRouteTitleEdit() {
  routeTitleDraft.value = routeTitle.value;
  routeTitleError.value = '';
  editingRouteTitle.value = true;
}
function cancelRouteTitleEdit() {
  editingRouteTitle.value = false;
  routeTitleError.value = '';
}
async function saveRouteTitle() {
  const id = routeId.value;
  const title = routeTitleDraft.value.trim();
  if (!title) {
    routeTitleError.value = '请输入路线标题。';
    return;
  }
  if (!id || !routeCode.value) {
    routeTitleError.value = '路线信息不完整，暂不能保存标题。';
    return;
  }
  savingRouteTitle.value = true;
  routeTitleError.value = '';
  try {
    await request('/api/route/update', {
      method: 'POST',
      body: { id, routeCode: routeCode.value, title } satisfies UpdateRouteTitlePayload,
    });
    editingRouteTitle.value = false;
    emit('title-saved', title);
  } catch (error) {
    routeTitleError.value = resolveRequestErrorMessage(error, '路线标题保存失败。');
  } finally {
    savingRouteTitle.value = false;
  }
}
</script>
<template>
  <Dialog v-model:open="isOpen">
    <DialogContent
      class="flex h-[92vh] max-w-[min(96vw,1560px)] flex-col overflow-hidden p-0">
      <div class="flex shrink-0 items-start border-b border-border/70 px-5 py-3 pr-12">
        <DialogHeader class="min-w-0 space-y-1.5 text-left">
          <div class="flex min-w-0 flex-wrap items-center gap-2">
            <DialogTitle v-if="!editingRouteTitle" class="truncate">
              {{ routeTitle }}
            </DialogTitle>
            <div v-else class="flex min-w-0 items-center gap-1.5">
              <Input v-model="routeTitleDraft" class="h-8 min-w-[220px] max-w-[420px]" aria-label="路线标题" :disabled="savingRouteTitle" @keyup.enter="saveRouteTitle" />
              <Button type="button" size="icon" class="h-8 w-8 shrink-0" :disabled="savingRouteTitle" aria-label="保存路线标题" title="保存路线标题" @click="saveRouteTitle"><Check class="h-4 w-4" /></Button>
              <Button variant="ghost" type="button" size="icon" class="h-8 w-8 shrink-0" :disabled="savingRouteTitle" aria-label="取消编辑路线标题" title="取消编辑" @click="cancelRouteTitleEdit"><X class="h-4 w-4" /></Button>
            </div>
            <Button v-if="props.canEdit && !editingRouteTitle" variant="ghost" type="button" size="icon" class="h-7 w-7 shrink-0" aria-label="编辑路线标题" title="编辑路线标题" @click="startRouteTitleEdit"><Pencil class="h-3.5 w-3.5" /></Button>
            <p v-if="routeTitleError" class="text-xs text-rose-300">{{ routeTitleError }}</p>
            <RouteStatusBadge v-if="props.record" :record="props.record" />
          </div>
          <DialogDescription>
            {{ routeMeta }}
          </DialogDescription>
          <p
            v-if="props.record?.auditStatus === 3 && props.record.auditRemark"
            class="text-xs text-rose-300">
            驳回原因：{{ props.record.auditRemark }}
          </p>
          <p
            v-if="!props.canEdit && props.lockMessage"
            class="text-xs text-amber-200/90">
            {{ props.lockMessage }}
          </p>
        </DialogHeader>
      </div>

      <div
        v-if="props.pending && !props.detail"
        class="flex min-h-0 flex-1 items-center justify-center text-sm text-muted-foreground">
        正在加载路线详情...
      </div>

      <div
        v-else
        class="grid min-h-0 flex-1 grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)] gap-5 overflow-hidden px-5 py-4">
        <!-- 左：画布 ~2 -->
        <section class="flex min-h-0 min-w-0 flex-col">
          <div
            class="relative min-h-0 flex-1 overflow-hidden rounded-xl border border-border/70 bg-background/70">
            <div
              v-if="props.canEdit"
              class="absolute right-3 top-3 z-10 flex items-center gap-1.5">
              <!-- 新增站点：暂注释，待完善创建字段后再开放
              <Button
                type="button"
                size="sm"
                variant="outline"
                class="h-8 px-2.5 text-xs"
                :disabled="creatingStage || deletingStage"
                @click="openStageCreate">
                <Plus class="mr-1 h-3.5 w-3.5" />
                新增
              </Button>
              -->
              <Button
                type="button"
                size="sm"
                variant="outline"
                class="h-8 px-2.5 text-xs text-rose-200 hover:bg-rose-500/10 hover:text-rose-100"
                :disabled="!selectedNode || deletingStage"
                @click="openStageDelete">
                <Trash2 class="mr-1 h-3.5 w-3.5" />
                删除
              </Button>
              <Button
                type="button"
                size="sm"
                class="h-8 px-3 text-xs"
                :disabled="!selectedNode || deletingStage"
                @click="openStageEditor">
                编辑
              </Button>
            </div>
            <VueFlow
              :nodes="flowNodes"
              :edges="flowEdges"
              fit-view-on-init
              :fit-view-options="{ padding: 0.28, includeHiddenNodes: false }"
              :min-zoom="0.35"
              :max-zoom="1.6"
              class="route-flow h-full"
              @node-click="selectFlowNode"
              @node-double-click="openStageEditorFromNode">
              <Background />
              <Controls />
            </VueFlow>
            <p
              v-if="!sortedNodes.length"
              class="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
              当前路线还没有站点
            </p>
          </div>
        </section>

        <!-- 中：手机模拟器外框（画面铺满，灵动岛叠在上方） -->
        <aside class="flex min-h-0 min-w-0 flex-col overflow-hidden">
          <AdminStageSimulator
            :stage="previewStage" />
        </aside>

        <!-- 右：对话 ~1 -->
        <section class="flex min-h-0 min-w-0 flex-col">
          <div
            v-if="!props.canEdit"
            class="mb-2 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
            {{ props.lockMessage || '当前内容已锁定，暂不可编辑。' }}
          </div>
          <RouteEditChatPane
            v-if="props.canEdit"
            ref="chatPaneRef"
            class="h-full min-h-0"
            :active="props.open"
            :route-id="routeId"
            :route-label="routeTitle"
            :stage-id="selectedStageId"
            :stage-label="stageAttachmentLabel"
            @clear-stage="clearStageAttachment"
            @request-detail-refresh="handleRequestDetailRefresh"
            @flush-detail-refresh="handleFlushDetailRefresh" />
          <div
            v-else
            class="flex min-h-0 flex-1 items-center justify-center rounded-xl border border-border/70 bg-background/40 px-4 text-center text-sm text-muted-foreground">
            内容已锁定，助手暂不可用。仍可查看左侧站点与中间预览；需要修改时，请先下线或等审核结束后再打开。
          </div>
        </section>
      </div>

      <!-- 业务操作统一右下角；待审时主按钮为「审核」 -->
      <DialogFooter class="h-14 shrink-0 items-center border-t border-border/70 px-5">
        <Button variant="outline" type="button" class="h-8" @click="closeDialog">
          关闭
        </Button>
        <Button
          v-if="props.actions?.canUnpublish"
          variant="outline"
          type="button"
          size="sm"
          class="h-8 px-3 text-xs"
          @click="emit('unpublish')">
          下线
        </Button>
        <Button
          v-if="props.actions?.canPublish"
          type="button"
          size="sm"
          class="h-8 px-3 text-xs"
          @click="emit('publish')">
          {{ props.record?.publishStatus === 3 ? '重新上架' : '上架' }}
        </Button>
        <Button
          v-if="props.actions?.canSubmitAudit"
          type="button"
          size="sm"
          class="h-8 px-3 text-xs"
          @click="emit('submitAudit')">
          提交审核
        </Button>
        <Button
          v-if="props.actions?.canAudit"
          type="button"
          size="sm"
          class="h-8 px-3 text-xs"
          @click="emit('audit')">
          审核
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <StageEditDialog
    v-model:open="stageEditOpen"
    :route-id="routeId"
    :node="selectedNode"
    :can-edit="props.canEdit"
    @saved="handleStageSaved"
    @preview-refresh="handleNarrationPreviewRefresh" />

  <!-- 新增站点弹窗：暂注释，待完善创建字段后再开放
  <Dialog v-model:open="stageCreateDialogOpen">
    <DialogContent class="max-w-[420px] overflow-hidden p-0">
      <div class="border-b border-border/70 px-5 py-3">
        <DialogHeader class="space-y-1 text-left">
          <DialogTitle>新增站点</DialogTitle>
          <DialogDescription>
            选择玩法类型后创建，可再编辑具体内容。
          </DialogDescription>
        </DialogHeader>
      </div>

      <div class="space-y-3 px-5 py-4">
        <label class="block space-y-1.5">
          <span class="text-xs font-medium text-muted-foreground">站点标题</span>
          <Input
            v-model="createTitleDraft"
            class="h-9"
            placeholder="例如：青花瓷纹样观察"
            :disabled="creatingStage"
            @keyup.enter="submitStageCreate" />
        </label>

        <div class="space-y-1.5">
          <span class="text-xs font-medium text-muted-foreground">玩法类型</span>
          <div class="grid grid-cols-2 gap-2" role="radiogroup" aria-label="玩法类型">
            <button
              v-for="option in interactionTypeOptions"
              :key="option.value"
              type="button"
              role="radio"
              class="h-9 rounded-md border px-2.5 text-left text-sm transition-colors"
              :class="createInteractionType === option.value
                ? 'border-primary/60 bg-primary/10 text-foreground'
                : 'border-border/70 bg-background text-muted-foreground hover:border-border hover:text-foreground'"
              :aria-checked="createInteractionType === option.value"
              :disabled="creatingStage"
              @click="createInteractionType = option.value">
              {{ option.label }}
            </button>
          </div>
        </div>

        <p v-if="createError" class="text-xs text-rose-300">
          {{ createError }}
        </p>
      </div>

      <DialogFooter class="border-t border-border/70 px-5 py-3">
        <Button
          variant="outline"
          type="button"
          class="h-8"
          :disabled="creatingStage"
          @click="closeStageCreate">
          取消
        </Button>
        <Button
          type="button"
          class="h-8"
          :disabled="creatingStage"
          @click="submitStageCreate">
          {{ creatingStage ? '创建中…' : '创建' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
  -->

  <Dialog v-model:open="stageDeleteDialogOpen">
    <DialogContent class="max-w-[min(92vw,24rem)] rounded-xl border border-border bg-[#15171b] p-0 text-left">
      <DialogHeader class="space-y-2 px-5 pb-2 pt-4">
        <DialogTitle>删除站点</DialogTitle>
        <DialogDescription>
          确认删除「{{ pendingDeleteStageLabel || '当前站点' }}」吗？删除后不可恢复。
        </DialogDescription>
      </DialogHeader>
      <DialogFooter class="px-5 pb-4 pt-3">
        <Button
          variant="outline"
          type="button"
          class="h-8"
          :disabled="deletingStage"
          @click="closeStageDelete">
          取消
        </Button>
        <Button
          variant="secondary"
          type="button"
          class="h-8"
          :disabled="deletingStage || !pendingDeleteStageId"
          @click="confirmStageDelete">
          {{ deletingStage ? '删除中…' : '确认删除' }}
        </Button>
      </DialogFooter>
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
  width: 168px;
  max-width: 168px;
  border-radius: 10px;
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

/* —— 中间列：手机模拟器外框 —— */
.route-device__chrome {
  position: relative;
  display: flex;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
  border-radius: 2rem;
  border: 1px solid rgb(255 255 255 / 10%);
  background: linear-gradient(165deg, #2a2d34 0%, #14161b 42%, #0c0d10 100%);
  box-shadow:
    0 12px 28px rgb(0 0 0 / 28%),
    inset 0 1px 0 rgb(255 255 255 / 8%),
    inset 0 0 0 1px rgb(0 0 0 / 35%);
  padding: 8px 8px 10px;
}

/* 屏幕铺满机身；状态栏 / 灵动岛叠在画面顶上 */
.route-device__screen {
  position: relative;
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  overflow: hidden;
  border-radius: 1.35rem;
  border: 1px solid rgb(255 255 255 / 6%);
  background: #0b0c0f;
  box-shadow:
    inset 0 0 0 1px rgb(0 0 0 / 40%),
    0 0 0 1px rgb(0 0 0 / 20%);
}

.route-device__status {
  position: absolute;
  top: 0;
  right: 0;
  left: 0;
  z-index: 20;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  height: 34px;
  padding: 8px 16px 0;
  color: rgb(255 255 255 / 78%);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
  pointer-events: none;
}

.route-device__time {
  justify-self: start;
  font-weight: 600;
}

.route-device__island {
  width: 86px;
  height: 22px;
  border-radius: 999px;
  background: #050506;
  box-shadow:
    inset 0 0 0 1px rgb(255 255 255 / 6%),
    0 1px 4px rgb(0 0 0 / 35%);
}

.route-device__signal {
  display: flex;
  align-items: flex-end;
  justify-self: end;
  gap: 2px;
  height: 10px;
  padding-bottom: 1px;
}

.route-device__signal i {
  display: block;
  width: 3px;
  border-radius: 1px;
  background: rgb(255 255 255 / 72%);
}

.route-device__signal i:nth-child(1) {
  height: 4px;
}

.route-device__signal i:nth-child(2) {
  height: 6px;
}

.route-device__signal i:nth-child(3) {
  height: 9px;
}

/* 画面从顶部铺满，内容可滚入灵动岛下方 */
.route-device__viewport {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior-y: contain;
  -webkit-overflow-scrolling: touch;
  touch-action: pan-y;
}

.route-device__viewport :deep(.gameplay-preview-root) {
  min-height: 100%;
  flex: 0 0 auto;
  height: auto;
  overflow: visible;
}

/* 顶栏安全区：内容从状态栏下开始，但背景仍延伸到岛下 */
.route-device__viewport :deep(.preview-shell) {
  padding-top: 36px;
}

.route-device__home {
  flex-shrink: 0;
  width: 96px;
  height: 4px;
  margin: 8px auto 0;
  border-radius: 999px;
  background: rgb(255 255 255 / 22%);
}
</style>
