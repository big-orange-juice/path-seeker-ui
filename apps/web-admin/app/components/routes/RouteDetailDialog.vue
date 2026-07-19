<script setup lang="ts">
import { Background } from '@vue-flow/background';
import { Controls } from '@vue-flow/controls';
import { Position, VueFlow, type Edge, type Node } from '@vue-flow/core';
import {
  GameplayPreviewHost,
  getInteractionTypeMeta,
  parseStageConfig,
  type GameplayPreviewNarration,
  type GameplayPreviewNarrationStatus,
  type GameplayPreviewStage,
  type NarrationRendererDraft
} from '@path-seeker/game-renderer';
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue';
import Button from '@/components/shadcn/button/Button.vue';
import Dialog from '@/components/shadcn/dialog/Dialog.vue';
import DialogContent from '@/components/shadcn/dialog/DialogContent.vue';
import DialogDescription from '@/components/shadcn/dialog/DialogDescription.vue';
import DialogFooter from '@/components/shadcn/dialog/DialogFooter.vue';
import DialogHeader from '@/components/shadcn/dialog/DialogHeader.vue';
import DialogTitle from '@/components/shadcn/dialog/DialogTitle.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import GuideSelectDialog from '@/components/guides/GuideSelectDialog.vue';
import RouteEditChatPane from '@/components/routes/RouteEditChatPane.vue';
import type { RouteWorkflowActions } from '@/constants/routeWorkflow';
import { mapGuideResponse } from '@/composables/useGuideManagement';
import type { GuideRecord, GuideResponse, GuideResponseListTotalPageResult } from '@/types/guide';
import type {
  NarrationDetailResponse,
  UpdateNarrationStageResponse,
} from '@/types/narration';
import type { RouteDetailResponse, RouteNodeResponse, RouteRecord } from '@/types/route';
import RouteStatusBadge from '@/components/routes/RouteStatusBadge.vue';
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
  /** SSE 驱动的静默刷新，不遮挡 workflow */
  'refresh-silent': [];
  publish: [];
  unpublish: [];
  submitAudit: [];
  audit: [];
}>();

const { request } = useApiClient();

const selectedStageId = shallowRef('');
const chatPaneRef = shallowRef<{
  resetSession: () => void;
  abortActiveRun: () => void;
} | null>(null);
const narrationDetail = shallowRef<NarrationDetailResponse | null>(null);
const narrationStatus = ref<GameplayPreviewNarrationStatus>('idle');
const narrationErrorMessage = ref('');
const narrationAudioGenerating = ref(false);
/** studio 本地覆盖：避免保存前/刷新间隙 props 冲掉用户刚改的 config */
const stageConfigOverrides = ref<Record<string, Record<string, unknown>>>({});
const stageTitleOverrides = ref<Record<string, string>>({});
const stageSaveErrorMessage = ref('');
const guidePickerOpen = shallowRef(false);
const guidePickerStageId = shallowRef('');
const guidePickerPending = shallowRef(false);
const guidePickerRows = shallowRef<GuideRecord[]>([]);

let detailRefreshTimer: ReturnType<typeof setTimeout> | null = null;
let pendingSilentRefresh = false;
let narrationRequestSeq = 0;
let narrationAudioPollTimer: ReturnType<typeof setTimeout> | null = null;
let stageSaveTimer: ReturnType<typeof setTimeout> | null = null;
let stageSaveSeq = 0;
/** 待落库的解说草稿（按 stageId） */
const pendingNarrationDrafts = new Map<string, NarrationRendererDraft>();

const isOpen = computed({
  get: () => props.open,
  set: (value: boolean) => emit('update:open', value)
});

const sortedNodes = computed(() =>
  [...(props.detail?.nodes ?? [])].sort((left, right) => {
    const leftOrder = left.sortOrder || left.stageNo || 0;
    const rightOrder = right.sortOrder || right.stageNo || 0;
    return leftOrder - rightOrder;
  })
);

const selectedNode = computed(
  () =>
    sortedNodes.value.find((node) => node.stageId === selectedStageId.value) ??
    null
);

/** 预览：有选中用选中，否则回退第一个节点方便查看 */
const previewNode = computed(
  () => selectedNode.value ?? sortedNodes.value[0] ?? null
);

/** 垂直串联：节点居中对齐，自上而下连接 */
const FLOW_NODE_X = 0;
const FLOW_NODE_GAP_Y = 130;

const flowNodes = computed<Node[]>(() =>
  sortedNodes.value.map((node, index) => {
    const stageId = String(node.stageId || '').trim();
    const title =
      (stageId && stageTitleOverrides.value[stageId])
      || node.title
      || '未命名节点';
    return {
      id: node.stageId || `stage-${index + 1}`,
      type: 'default',
      position: {
        x: FLOW_NODE_X,
        y: index * FLOW_NODE_GAP_Y
      },
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
      data: {
        label: `${node.sortOrder || index + 1}. ${title}\n${getInteractionTypeName(node.interactionType)}`
      },
      class:
        node.stageId && node.stageId === selectedStageId.value
          ? 'is-selected-route-node'
          : ''
    };
  })
);

const flowEdges = computed<Edge[]>(() =>
  flowNodes.value.slice(1).map((node, index) => ({
    id: `${flowNodes.value[index]?.id}-${node.id}`,
    source: flowNodes.value[index]?.id ?? '',
    target: node.id,
    type: 'smoothstep',
    animated: true
  }))
);

const mapNarrationPreview = (
  detail: NarrationDetailResponse | null
): GameplayPreviewNarration | null => {
  if (!detail) {
    return null;
  }

  return {
    narrationText:
      detail.narrationText != null ? String(detail.narrationText) : null,
    audioUrl: detail.audioUrl != null ? String(detail.audioUrl) : null,
    guideId: detail.guideId != null ? String(detail.guideId) : null,
    guideName: detail.guideName != null ? String(detail.guideName) : null,
    resolvedStyle:
      detail.resolvedStyle != null ? String(detail.resolvedStyle) : null,
    durationMs:
      typeof detail.durationMs === 'number' ? detail.durationMs : null,
    textStatus:
      typeof detail.textStatus === 'number' ? detail.textStatus : null,
    audioStatus:
      typeof detail.audioStatus === 'number' ? detail.audioStatus : null,
    textError: detail.textError != null ? String(detail.textError) : null
  };
};

const previewStage = computed<GameplayPreviewStage | null>(() => {
  const node = previewNode.value;
  if (!node) {
    return null;
  }

  const stageId = String(node.stageId || '').trim();
  const interactionType = node.interactionType || 0;
  const isNarration = interactionType === 11;
  const titleOverride = stageId ? stageTitleOverrides.value[stageId] : undefined;
  const configOverride = stageId ? stageConfigOverrides.value[stageId] : undefined;

  return {
    stageId,
    interactionType,
    title: titleOverride || node.title || '未命名节点',
    subtitle: node.subtitle,
    exhibitName: node.exhibitName,
    galleryName: node.galleryName,
    score: node.score,
    config: {
      ...parseNodeConfig(node),
      ...(configOverride ?? {})
    },
    narration: isNarration ? mapNarrationPreview(narrationDetail.value) : null,
    narrationStatus: isNarration ? narrationStatus.value : 'idle',
    narrationErrorMessage: isNarration
      ? stageSaveErrorMessage.value || narrationErrorMessage.value
      : null
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

const clearNarrationAudioPoll = () => {
  if (narrationAudioPollTimer) {
    clearTimeout(narrationAudioPollTimer);
    narrationAudioPollTimer = null;
  }
};

const isAudioStillGenerating = (detail: NarrationDetailResponse | null) => {
  if (!detail) {
    return false;
  }

  const audioUrl = String(detail.audioUrl ?? '').trim();
  if (audioUrl) {
    return false;
  }

  const status = Number(detail.audioStatus ?? 0);
  // 1=Queued 2=Generating
  return status === 1 || status === 2;
};

const loadNarrationDetail = async (
  stageId: string,
  options?: { silent?: boolean }
) => {
  const requestId = ++narrationRequestSeq;
  const silent = Boolean(options?.silent);

  if (!silent) {
    narrationStatus.value = 'loading';
    narrationErrorMessage.value = '';
    narrationDetail.value = null;
  }

  try {
    const detail = await request<NarrationDetailResponse | null>(
      '/api/narration/detail',
      {
        method: 'GET',
        query: {
          stageId
        }
      }
    );

    if (requestId !== narrationRequestSeq) {
      return null;
    }

    narrationDetail.value = detail;
    narrationStatus.value = 'ready';

    if (!detail?.narrationText && detail?.textError) {
      narrationErrorMessage.value = String(detail.textError);
    }

    if (!isAudioStillGenerating(detail)) {
      narrationAudioGenerating.value = false;
      clearNarrationAudioPoll();
    }

    return detail;
  } catch (error) {
    if (requestId !== narrationRequestSeq) {
      return null;
    }

    if (!silent) {
      narrationDetail.value = null;
      narrationStatus.value = 'error';
      narrationErrorMessage.value = resolveRequestErrorMessage(
        error,
        '解说词加载失败。'
      );
    }

    narrationAudioGenerating.value = false;
    clearNarrationAudioPoll();
    return null;
  }
};

const pollNarrationAudio = (stageId: string, attempt = 0) => {
  clearNarrationAudioPoll();

  if (attempt >= 20) {
    narrationAudioGenerating.value = false;
    return;
  }

  narrationAudioPollTimer = setTimeout(async () => {
    narrationAudioPollTimer = null;
    const detail = await loadNarrationDetail(stageId, { silent: true });

    if (isAudioStillGenerating(detail)) {
      pollNarrationAudio(stageId, attempt + 1);
      return;
    }

    narrationAudioGenerating.value = false;
  }, 2000);
};

const handleGenerateNarrationAudio = async (stageId: string) => {
  // 只读（审核/已上架等）不允许触发生成
  if (!props.canEdit) {
    return;
  }

  const id = String(stageId || '').trim();
  if (!id || narrationAudioGenerating.value) {
    return;
  }

  narrationAudioGenerating.value = true;
  narrationErrorMessage.value = '';

  try {
    await request('/api/narration/generate-audio', {
      method: 'POST',
      body: {
        stageId: id
      }
    });

    await loadNarrationDetail(id, { silent: true });
    pollNarrationAudio(id);
  } catch (error) {
    narrationAudioGenerating.value = false;
    narrationErrorMessage.value = resolveRequestErrorMessage(
      error,
      '语音生成请求失败。'
    );
  }
};

const clearStageSaveTimer = () => {
  if (stageSaveTimer) {
    clearTimeout(stageSaveTimer);
    stageSaveTimer = null;
  }
};

const applyNarrationDraftLocally = (
  stageId: string,
  draft: NarrationRendererDraft
) => {
  const prev = stageConfigOverrides.value[stageId] ?? {};
  const next: Record<string, unknown> = { ...prev };

  if (typeof draft.style === 'string') {
    next.user_style_input = draft.style.trim();
  }
  if (typeof draft.sceneContext === 'string') {
    next.scene_context = draft.sceneContext.trim();
  }
  if (typeof draft.targetDurationSeconds === 'number') {
    const sec = Math.max(1, Math.round(draft.targetDurationSeconds) || 90);
    next.target_duration_seconds = sec;
  }
  if (typeof draft.guideId === 'string') {
    const guideId = draft.guideId.trim();
    next.guide_id = guideId || null;
  }
  if (typeof draft.guideName === 'string') {
    next.guide_name = draft.guideName.trim();
  }

  stageConfigOverrides.value = {
    ...stageConfigOverrides.value,
    [stageId]: next
  };

  if (typeof draft.title === 'string' && draft.title.trim()) {
    stageTitleOverrides.value = {
      ...stageTitleOverrides.value,
      [stageId]: draft.title.trim()
    };
  }
};

const resolveGuideIdForStage = (
  stageId: string,
  node: RouteNodeResponse,
  draft: NarrationRendererDraft
) => {
  if (typeof draft.guideId === 'string' && draft.guideId.trim()) {
    return draft.guideId.trim();
  }
  const override = stageConfigOverrides.value[stageId];
  if (override && Object.prototype.hasOwnProperty.call(override, 'guide_id')) {
    const value = override.guide_id;
    if (value == null || value === '') {
      return null;
    }
    return String(value).trim() || null;
  }
  const fromDetail = String(narrationDetail.value?.guideId ?? '').trim();
  if (fromDetail) {
    return fromDetail;
  }
  const config = parseNodeConfig(node);
  if (config.guide_id != null && config.guide_id !== '') {
    return String(config.guide_id).trim() || null;
  }
  return null;
};

const persistNarrationDraft = async (
  stageId: string,
  draft: NarrationRendererDraft
) => {
  if (!props.canEdit) {
    return;
  }

  const node =
    sortedNodes.value.find((item) => String(item.stageId || '') === stageId) ??
    null;

  if (!node) {
    return;
  }

  const requestId = ++stageSaveSeq;
  stageSaveErrorMessage.value = '';

  try {
    const mergedConfig = {
      ...parseNodeConfig(node),
      ...(stageConfigOverrides.value[stageId] ?? {})
    };

    const prevGuideId = String(
      narrationDetail.value?.guideId
      ?? mergedConfig.guide_id
      ?? ''
    ).trim();
    const nextGuideId = resolveGuideIdForStage(stageId, node, draft);
    const guideChanged =
      String(nextGuideId ?? '').trim() !== prevGuideId;

    const nextTitle =
      stageTitleOverrides.value[stageId] ||
      (typeof draft.title === 'string' ? draft.title.trim() : '') ||
      node.title ||
      null;

    const sceneContext =
      typeof draft.sceneContext === 'string'
        ? draft.sceneContext.trim()
        : String(mergedConfig.scene_context ?? '').trim() || null;

    const userStyleInput =
      typeof draft.style === 'string'
        ? draft.style.trim()
        : String(mergedConfig.user_style_input ?? '').trim() || null;

    let targetDurationSeconds: number | null = null;
    if (typeof draft.targetDurationSeconds === 'number') {
      targetDurationSeconds = Math.min(
        600,
        Math.max(10, Math.round(draft.targetDurationSeconds) || 90)
      );
    } else {
      const fromConfig = Number(mergedConfig.target_duration_seconds);
      if (Number.isFinite(fromConfig) && fromConfig > 0) {
        targetDurationSeconds = Math.min(600, Math.max(10, Math.round(fromConfig)));
      }
    }

    // 导览节点：走 Narration/update-stage
    const stageResult = await request<UpdateNarrationStageResponse | null>(
      '/api/narration/update-stage',
      {
        method: 'POST',
        body: {
          stageId,
          title: nextTitle,
          subtitle: node.subtitle,
          exhibitId: node.refExhibitId != null ? String(node.refExhibitId) : null,
          guideId: nextGuideId,
          userStyleInput,
          sceneContext,
          targetDurationSeconds,
        }
      }
    );

    // 仅正文真正变更时写解说 API；返回体直接回填，避免再 GET detail
    const nextText = String(draft.narrationText ?? '').trim();
    const currentText = String(narrationDetail.value?.narrationText ?? '').trim();
    const textChanged = Boolean(nextText && nextText !== currentText);
    if (textChanged) {
      const version =
        typeof narrationDetail.value?.version === 'number'
          ? narrationDetail.value.version
          : undefined;
      const updated = await request<NarrationDetailResponse | null>(
        '/api/narration/update-text',
        {
          method: 'POST',
          body: {
            stageId,
            narrationText: nextText,
            ...(version != null ? { version } : {})
          }
        }
      );

      if (requestId === stageSaveSeq && updated) {
        narrationDetail.value = updated;
        narrationStatus.value = 'ready';
      }
    } else if (
      requestId === stageSaveSeq
      && (guideChanged || Boolean(stageResult?.narrationReset))
    ) {
      // 换导游 / 产物被重置时才重拉解说；普通场景/时长修改用本地 override，避免连环 detail
      await loadNarrationDetail(stageId, { silent: true });
    }

    // 画布标题已走 stageTitleOverrides，模拟器字段走本地 override；
    // 不再每次编辑都静默拉 route detail，避免 detail → 再触发 narration/detail 连环请求
  } catch (error) {
    if (requestId !== stageSaveSeq) {
      return;
    }
    stageSaveErrorMessage.value = resolveRequestErrorMessage(
      error,
      '节点编辑保存失败。'
    );
  }
};

const loadGuidePickerRows = async () => {
  guidePickerPending.value = true;
  try {
    const result = await request<GuideResponseListTotalPageResult>(
      '/api/guide/query',
      {
        query: {
          status: 1,
          pageIndex: 1,
          pageSize: 100,
        },
      }
    );
    guidePickerRows.value = (result?.list ?? [])
      .map((item: GuideResponse) => mapGuideResponse(item))
      .filter((item) => Boolean(item.id) && !item.isGenerating);
  } catch (error) {
    guidePickerRows.value = [];
    stageSaveErrorMessage.value = resolveRequestErrorMessage(
      error,
      '导游列表加载失败。'
    );
  } finally {
    guidePickerPending.value = false;
  }
};

const handlePickGuide = (stageId: string) => {
  if (!props.canEdit) {
    return;
  }
  const id = String(stageId || '').trim();
  if (!id) {
    return;
  }
  guidePickerStageId.value = id;
  guidePickerOpen.value = true;
  void loadGuidePickerRows();
};

const handleGuideSelected = (guide: GuideRecord) => {
  const stageId = String(guidePickerStageId.value || '').trim();
  if (!stageId || !props.canEdit) {
    return;
  }

  const draft: NarrationRendererDraft = {
    guideId: guide.id,
    guideName: guide.name || '',
  };
  applyNarrationDraftLocally(stageId, draft);
  pendingNarrationDrafts.set(stageId, {
    ...(pendingNarrationDrafts.get(stageId) ?? {}),
    ...draft,
  });

  // 乐观更新 detail 中的导游展示（config override 同步生效）
  if (narrationDetail.value) {
    const detailStageId = String(narrationDetail.value.stageId || '').trim();
    if (!detailStageId || detailStageId === stageId) {
      narrationDetail.value = {
        ...narrationDetail.value,
        guideId: guide.id,
        guideName: guide.name || null,
      };
    }
  }

  clearStageSaveTimer();
  stageSaveTimer = setTimeout(() => {
    stageSaveTimer = null;
    flushPendingNarrationDraft();
  }, 200);
};

const currentGuideIdForPicker = computed(() => {
  const stageId = String(guidePickerStageId.value || '').trim();
  if (!stageId) {
    return null;
  }
  const override = stageConfigOverrides.value[stageId];
  if (override?.guide_id != null && override.guide_id !== '') {
    return String(override.guide_id);
  }
  return narrationDetail.value?.guideId
    ? String(narrationDetail.value.guideId)
    : null;
});

const flushPendingNarrationDraft = () => {
  clearStageSaveTimer();
  const entries = [...pendingNarrationDrafts.entries()];
  pendingNarrationDrafts.clear();

  for (const [stageId, draft] of entries) {
    void persistNarrationDraft(stageId, draft);
  }
};

const handleNarrationDraft = (payload: {
  stageId: string;
  draft: NarrationRendererDraft;
}) => {
  const stageId = String(payload.stageId || '').trim();
  if (!stageId || !props.canEdit) {
    return;
  }

  const draft = payload.draft ?? {};
  applyNarrationDraftLocally(stageId, draft);
  pendingNarrationDrafts.set(stageId, {
    ...(pendingNarrationDrafts.get(stageId) ?? {}),
    ...draft
  });

  clearStageSaveTimer();
  // 风格/场景弹层点确定、时长 blur 等都会触发；短防抖合并连点
  stageSaveTimer = setTimeout(() => {
    stageSaveTimer = null;
    flushPendingNarrationDraft();
  }, 350);
};

/**
 * 用原始字符串作 watch 源，避免每次 props.detail 换引用都误触发。
 * detailStamp 取当前导览节点 title/config，便于对话侧静默刷新后只拉一次解说。
 */
const narrationWatchKey = computed(() => {
  if (!props.open) {
    return '';
  }
  const node = previewNode.value;
  if (!node || Number(node.interactionType || 0) !== 11) {
    return '';
  }
  const stageId = String(node.stageId || '').trim();
  if (!stageId) {
    return '';
  }
  return [
    stageId,
    String(node.title || ''),
    String(node.subtitle || ''),
    String(node.config || ''),
  ].join('\u0001');
});

watch(
  narrationWatchKey,
  (key) => {
    if (!key) {
      narrationRequestSeq += 1;
      clearNarrationAudioPoll();
      narrationDetail.value = null;
      narrationStatus.value = 'idle';
      narrationErrorMessage.value = '';
      narrationAudioGenerating.value = false;
      return;
    }

    const stageId = key.split('\u0001')[0] || '';
    if (!stageId) {
      return;
    }
    void loadNarrationDetail(stageId);
  },
  { immediate: true }
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

  const order =
    node.sortOrder ||
    sortedNodes.value.findIndex((item) => item.stageId === node.stageId) + 1;
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
  { immediate: true }
);

const destroyLocalDialogState = () => {
  clearDetailRefreshTimer();
  clearNarrationAudioPoll();
  clearStageSaveTimer();
  pendingSilentRefresh = false;
  pendingNarrationDrafts.clear();
  stageSaveSeq += 1;
  selectedStageId.value = '';
  narrationDetail.value = null;
  narrationStatus.value = 'idle';
  narrationErrorMessage.value = '';
  narrationAudioGenerating.value = false;
  narrationRequestSeq += 1;
  stageConfigOverrides.value = {};
  stageTitleOverrides.value = {};
  stageSaveErrorMessage.value = '';
  guidePickerOpen.value = false;
  guidePickerStageId.value = '';
  guidePickerRows.value = [];
  chatPaneRef.value?.abortActiveRun();
  chatPaneRef.value?.resetSession();
};

watch(
  () => props.open,
  (open) => {
    if (open) {
      return;
    }
    // 关闭时销毁本轮详情侧状态（节点选中、解说、聊天会话）
    destroyLocalDialogState();
  }
);

watch(routeId, (next, prev) => {
  if (prev && next && prev !== next) {
    selectedStageId.value = '';
    chatPaneRef.value?.resetSession();
  }
});

onBeforeUnmount(() => {
  clearDetailRefreshTimer();
  clearNarrationAudioPoll();
  clearStageSaveTimer();
  chatPaneRef.value?.abortActiveRun();
});

function parseNodeConfig(node: RouteNodeResponse): Record<string, unknown> {
  return parseStageConfig(node.config) as Record<string, unknown>;
}

function selectFlowNode(event: { node: Node }) {
  // 仅用户点击 workflow 节点时挂上 stage 附件
  selectedStageId.value = String(event.node.id || '').trim();
}

function clearStageAttachment() {
  selectedStageId.value = '';
}

function getInteractionTypeName(interactionType: number) {
  return (
    getInteractionTypeMeta(interactionType)?.label ||
    `未知玩法 ${interactionType}`
  );
}

function closeDialog() {
  isOpen.value = false;
}
</script>

<template>
  <Dialog v-model:open="isOpen">
    <DialogContent
      class="flex h-[92vh] max-w-[min(96vw,1560px)] flex-col overflow-hidden p-0">
      <DialogHeader class="shrink-0 border-b border-border/70 px-5 py-3">
        <div class="flex min-w-0 items-start justify-between gap-3">
          <div class="min-w-0 space-y-1.5">
            <div class="flex min-w-0 flex-wrap items-center gap-2">
              <DialogTitle class="truncate">
                {{ routeTitle }}
              </DialogTitle>
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
          </div>
          <Button
            variant="ghost"
            size="icon"
            title="关闭"
            class="shrink-0"
            @click="closeDialog">
            <AppIcon name="x" class="h-4 w-4" />
          </Button>
        </div>
      </DialogHeader>

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

        <!-- 中：手机模拟器外框（画面铺满，灵动岛叠在上方） -->
        <aside class="flex min-h-0 min-w-0 flex-col overflow-hidden">
          <div class="route-device__chrome min-h-0 flex-1">
            <div class="route-device__screen">
              <!-- 状态栏 / 灵动岛：绝对定位叠在画面顶，不占布局高度 -->
              <div class="route-device__status" aria-hidden="true">
                <span class="route-device__time">9:41</span>
                <span class="route-device__island" />
                <span class="route-device__signal">
                  <i /><i /><i />
                </span>
              </div>

              <div class="route-device__viewport">
                <GameplayPreviewHost
                  v-if="previewStage"
                  class="h-full min-h-0"
                  :stage="previewStage"
                  :surface-mode="props.canEdit ? 'studio' : 'play'"
                  :narration-audio-generating="narrationAudioGenerating"
                  @generate-audio="handleGenerateNarrationAudio"
                  @narration-draft="handleNarrationDraft"
                  @pick-guide="handlePickGuide" />
                <div
                  v-else
                  class="flex h-full min-h-[200px] items-center justify-center px-4 text-center text-sm text-white/45">
                  点击左侧节点预览
                </div>
              </div>
            </div>

            <div class="route-device__home" aria-hidden="true" />
          </div>
        </aside>

        <!-- 右：对话 ~1 -->
        <section class="flex min-h-0 min-w-0 flex-col">
          <div
            v-if="!props.canEdit"
            class="mb-2 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
            {{ props.lockMessage || '当前状态不可编辑。' }}
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
            内容已锁定，可查看左侧节点与预览。
          </div>
        </section>
      </div>

      <!-- 业务操作统一右下角；待审时主按钮为「审核」 -->
      <DialogFooter class="shrink-0 border-t border-border/70 px-5 py-3">
        <Button variant="outline" type="button" @click="closeDialog">
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

  <GuideSelectDialog
    v-model:open="guidePickerOpen"
    :guides="guidePickerRows"
    :pending="guidePickerPending"
    :selected-id="currentGuideIdForPicker"
    @select="handleGuideSelected" />
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
  overflow: hidden;
}

.route-device__viewport :deep(.gameplay-preview-root) {
  min-height: 0;
  flex: 1;
  overflow: hidden;
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
