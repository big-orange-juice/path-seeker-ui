<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue';
import RouteAuditDialog from '@/components/routes/RouteAuditDialog.vue';
import RouteCreateDialog from '@/components/routes/RouteCreateDialog.vue';
import RouteDataTable from '@/components/routes/RouteDataTable.vue';
import RouteDetailDialog from '@/components/routes/RouteDetailDialog.vue';
import Button from '@/components/shadcn/button/Button.vue';
import Dialog from '@/components/shadcn/dialog/Dialog.vue';
import DialogContent from '@/components/shadcn/dialog/DialogContent.vue';
import DialogDescription from '@/components/shadcn/dialog/DialogDescription.vue';
import DialogFooter from '@/components/shadcn/dialog/DialogFooter.vue';
import DialogHeader from '@/components/shadcn/dialog/DialogHeader.vue';
import DialogTitle from '@/components/shadcn/dialog/DialogTitle.vue';
import Input from '@/components/shadcn/input/Input.vue';
import Select from '@/components/shadcn/select/Select.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import {
  ROUTE_AUDIT_STATUS_OPTIONS,
  ROUTE_PUBLISH_STATUS_OPTIONS,
  useRouteLibrary,
} from '@/composables/useRouteLibrary';
import {
  PUBLISH_OFFLINE,
  PUBLISH_ONLINE,
  getEditLockMessage,
  getRouteWorkflowActions,
} from '@/constants/routeWorkflow';
import { useAdminAuthStore } from '@/stores/adminAuth';
import type { BuildRouteFromThemePayload, RouteDetailResponse, RouteRecord } from '@/types/route';
import type { MuseumResponse, MuseumResponseListTotalPageResult } from '@/types/museum';

definePageMeta({
  middleware: 'admin-auth',
});

const authStore = useAdminAuthStore();
const selectedMuseumId = shallowRef('');
const { request } = useApiClient();
const createDialogOpen = shallowRef(false);
const createSubmitting = shallowRef(false);
const createError = shallowRef('');
const actionPendingIds = shallowRef<string[]>([]);
const actionFeedback = shallowRef('');
const actionError = shallowRef('');
const confirmDialogOpen = shallowRef(false);
const confirmActionType = shallowRef<'publish' | 'unpublish' | 'delete' | 'submit-audit'>('publish');
const confirmRecord = shallowRef<RouteRecord | null>(null);
const detailDialogOpen = shallowRef(false);
const detailPending = shallowRef(false);
const detailRecord = shallowRef<RouteRecord | null>(null);
const routeDetail = shallowRef<RouteDetailResponse | null>(null);
const auditDialogOpen = shallowRef(false);
const auditRecord = shallowRef<RouteRecord | null>(null);
const auditSubmitting = shallowRef(false);

const workflowContext = computed(() => ({
  roleCode: authStore.roleCode,
  adminId: authStore.adminId,
}));

const { data: museumData, pending: museumPending } = useAsyncData(
  'route-library:museums',
  () => request<MuseumResponseListTotalPageResult<MuseumResponse>>('/api/museum-management/query', {
    method: 'POST',
    body: {
      pageIndex: 1,
      pageSize: 1000,
      keyword: null,
      status: null,
    },
  }),
  {
    default: () => ({
      list: [],
      pageIndex: 1,
      pageSize: 1000,
      total: 0,
      totalPages: 0,
    }),
  }
);

const museumOptions = computed(() =>
  (museumData.value.list ?? [])
    .filter((museum) => museum.id)
    .map((museum) => ({
      value: String(museum.id),
      label: [museum.museumCode, museum.name].filter(Boolean).join(' / ') || String(museum.id),
    }))
);

watch(
  museumOptions,
  (options) => {
    if (!options.length) {
      selectedMuseumId.value = '';
      return;
    }

    if (options.some((option) => option.value === selectedMuseumId.value)) {
      return;
    }

    selectedMuseumId.value = options[0]?.value ?? '';
  },
  { immediate: true }
);

const {
  filters,
  rows,
  pending,
  error,
  refresh,
  pageIndex,
  pageSize,
  sorting,
  total,
  totalPages,
  setPage,
  setPageSize,
  resetFilters,
  setPendingAuditFilter,
  toggleSort,
  publishRoute,
  submitAudit,
  auditRoute,
  deleteRoute,
  fetchRouteDetail,
} = useRouteLibrary(() => selectedMuseumId.value);

const handleCreateManual = async (payload: BuildRouteFromThemePayload) => {
  createSubmitting.value = true;
  createError.value = '';

  try {
    await request<string>('/api/route/build-from-theme', {
      method: 'POST',
      body: payload,
    });
    createDialogOpen.value = false;
    await refresh();
  } catch (caughtError) {
    createError.value = caughtError instanceof Error ? caughtError.message : '主题路线创建失败。';
  } finally {
    createSubmitting.value = false;
  }
};

const handleChatRouteChanged = async (_routeId: string) => {
  actionFeedback.value = '';
  actionError.value = '';

  try {
    await refresh();
  } catch (caughtError) {
    actionError.value = resolveActionErrorMessage(caughtError, '路线列表刷新失败。');
  }
};

const handleChatRoutePublished = async (routeId: string) => {
  actionFeedback.value = '路线状态已更新。';
  await handleChatRouteChanged(routeId);
};

const startRowAction = (routeId: string) => {
  if (actionPendingIds.value.includes(routeId)) {
    return;
  }

  actionPendingIds.value = [...actionPendingIds.value, routeId];
};

const finishRowAction = (routeId: string) => {
  actionPendingIds.value = actionPendingIds.value.filter((item) => item !== routeId);
};

const resolveActionErrorMessage = (caughtError: unknown, fallback: string) =>
  caughtError instanceof Error ? caughtError.message : fallback;

const confirmDialogTitle = computed(() => {
  switch (confirmActionType.value) {
    case 'publish':
      return '确认上架路线';
    case 'unpublish':
      return '确认下线路线';
    case 'submit-audit':
      return '确认提交审核';
    default:
      return '确认删除路线';
  }
});

const confirmDialogDescription = computed(() => {
  const record = confirmRecord.value;
  const routeName = record?.title || record?.routeCode || record?.id || '当前路线';

  switch (confirmActionType.value) {
    case 'publish':
      return `确认上架「${routeName}」吗？上架后内容不可编辑。`;
    case 'unpublish':
      return authStore.isGuide
        ? `确认下线「${routeName}」吗？下线后可修改，再次上架前需重新审核。`
        : `确认下线「${routeName}」吗？下线后可修改内容。`;
    case 'submit-audit':
      return `确认将「${routeName}」提交审核吗？提交后内容将锁定，直至审核完成。`;
    default:
      return `确认删除「${routeName}」吗？仅未上架且非待审的本人路线可删，删除后不可恢复。`;
  }
});

const confirmActionLabel = computed(() => {
  switch (confirmActionType.value) {
    case 'publish':
      return '确认上架';
    case 'unpublish':
      return '确认下线';
    case 'submit-audit':
      return '确认提交';
    default:
      return '确认删除';
  }
});

const openConfirmDialog = (
  type: 'publish' | 'unpublish' | 'delete' | 'submit-audit',
  record: RouteRecord,
) => {
  confirmActionType.value = type;
  confirmRecord.value = record;
  confirmDialogOpen.value = true;
};

const resetConfirmDialog = () => {
  confirmDialogOpen.value = false;
  confirmRecord.value = null;
};

/** 关闭详情时销毁上一次的详情与列表行缓存，避免再次打开闪旧数据 */
const destroyDetailDialogState = () => {
  detailDialogOpen.value = false;
  detailPending.value = false;
  detailRecord.value = null;
  routeDetail.value = null;
};

const onDetailDialogOpenChange = (value: boolean) => {
  if (!value) {
    destroyDetailDialogState();
    return;
  }
  detailDialogOpen.value = true;
};

const onAuditDialogOpenChange = (value: boolean) => {
  auditDialogOpen.value = value;
  if (!value) {
    auditRecord.value = null;
    auditSubmitting.value = false;
  }
};

const handleDetail = async (record: RouteRecord) => {
  actionFeedback.value = '';
  actionError.value = '';

  const actions = getRouteWorkflowActions(record, workflowContext.value);
  if (!actions.canOpenDetail) {
    actionError.value = actions.isListOnly
      ? '他人未上架/已下线路线仅列表可见（待审核除外），不可查看详情。'
      : '当前账号无权查看该路线详情。';
    return;
  }

  // 先清空再挂载，保证 dialog 不复用上一条路线的节点/会话
  routeDetail.value = null;
  detailRecord.value = record;
  detailDialogOpen.value = true;
  detailPending.value = true;
  startRowAction(record.id);

  try {
    routeDetail.value = await fetchRouteDetail(record.id);
  } catch (caughtError) {
    actionError.value = resolveActionErrorMessage(caughtError, '主题路线详情获取失败。');
  } finally {
    detailPending.value = false;
    finishRowAction(record.id);
  }
};

watch(detailDialogOpen, (open) => {
  if (!open) {
    // 关闭动画结束后再清亦可；立即清以免下次 open 前残留
    detailPending.value = false;
    detailRecord.value = null;
    routeDetail.value = null;
  }
});

const refreshRouteRow = async (record: RouteRecord) => {
  actionFeedback.value = '';
  actionError.value = '';
  startRowAction(record.id);

  try {
    await refresh();
    actionFeedback.value = `已刷新「${record.title || record.routeCode || record.id}」。`;
  } catch (caughtError) {
    actionError.value = resolveActionErrorMessage(caughtError, '主题路线刷新失败。');
  } finally {
    finishRowAction(record.id);
  }
};

const refreshRouteDetail = async (options?: { silent?: boolean }) => {
  const record = detailRecord.value;
  if (!record) {
    return;
  }

  const silent = Boolean(options?.silent);
  if (!silent) {
    detailPending.value = true;
  }

  actionError.value = '';

  try {
    routeDetail.value = await fetchRouteDetail(record.id);
    // 同步列表行状态，保持详情工具栏与锁一致
    const latest = rows.value.find((item) => item.id === record.id);
    if (latest) {
      detailRecord.value = latest;
    }
  } catch (caughtError) {
    if (!silent) {
      actionError.value = resolveActionErrorMessage(caughtError, '主题路线详情刷新失败。');
    }
  } finally {
    if (!silent) {
      detailPending.value = false;
    }
  }
};

const assertWorkflowAction = (
  record: RouteRecord,
  key: 'canPublish' | 'canUnpublish' | 'canSubmitAudit' | 'canAudit' | 'canDelete' | 'canEditContent',
  deniedMessage: string,
) => {
  const actions = getRouteWorkflowActions(record, workflowContext.value);
  if (!actions[key]) {
    actionError.value = deniedMessage;
    return false;
  }
  return true;
};

const handlePublish = (record: RouteRecord) => {
  if (!assertWorkflowAction(record, 'canPublish', '无权上架该路线（仅归属人且满足审核条件）。')) {
    return;
  }
  openConfirmDialog('publish', record);
};

const handleUnpublish = (record: RouteRecord) => {
  if (!assertWorkflowAction(record, 'canUnpublish', '无权下线该路线（仅归属人可下线）。')) {
    return;
  }
  openConfirmDialog('unpublish', record);
};

const handleSubmitAudit = (record: RouteRecord) => {
  if (!assertWorkflowAction(record, 'canSubmitAudit', '无权提交审核。')) {
    return;
  }
  openConfirmDialog('submit-audit', record);
};

const handleAudit = (record: RouteRecord) => {
  if (!assertWorkflowAction(record, 'canAudit', '无权审核该路线。')) {
    return;
  }
  auditRecord.value = record;
  auditDialogOpen.value = true;
};

watch(auditDialogOpen, (open) => {
  if (!open) {
    auditRecord.value = null;
    auditSubmitting.value = false;
  }
});

const handleRemove = (record: RouteRecord) => {
  if (!assertWorkflowAction(record, 'canDelete', '无权删除该路线（仅归属人可删未上架且非待审路线）。')) {
    return;
  }
  openConfirmDialog('delete', record);
};

const submitConfirmedAction = async () => {
  const record = confirmRecord.value;
  if (!record) {
    return;
  }

  actionFeedback.value = '';
  actionError.value = '';
  startRowAction(record.id);

  try {
    if (confirmActionType.value === 'publish') {
      await publishRoute({
        id: record.id,
        publishStatus: PUBLISH_ONLINE,
      });
      actionFeedback.value = `已上架「${record.title || record.routeCode || record.id}」。`;
    } else if (confirmActionType.value === 'unpublish') {
      await publishRoute({
        id: record.id,
        publishStatus: PUBLISH_OFFLINE,
      });
      actionFeedback.value = `已下线「${record.title || record.routeCode || record.id}」。`;
    } else if (confirmActionType.value === 'submit-audit') {
      await submitAudit({ id: record.id });
      actionFeedback.value = `已提交审核「${record.title || record.routeCode || record.id}」。`;
    } else {
      await deleteRoute(record.id);
      actionFeedback.value = `已删除「${record.title || record.routeCode || record.id}」。`;
    }
    resetConfirmDialog();
  } catch (caughtError) {
    const fallback =
      confirmActionType.value === 'publish'
        ? '主题路线上架失败。'
        : confirmActionType.value === 'unpublish'
          ? '主题路线下线失败。'
          : confirmActionType.value === 'submit-audit'
            ? '提交审核失败。'
            : '主题路线删除失败。';
    actionError.value = resolveActionErrorMessage(caughtError, fallback);
  } finally {
    finishRowAction(record.id);
  }
};

const submitAuditDecision = async (payload: { pass: boolean; remark: string }) => {
  const record = auditRecord.value;
  if (!record) {
    return;
  }

  actionFeedback.value = '';
  actionError.value = '';
  auditSubmitting.value = true;
  startRowAction(record.id);

  try {
    await auditRoute({
      id: record.id,
      pass: payload.pass,
      remark: payload.remark || null,
    });
    actionFeedback.value = payload.pass
      ? `已通过「${record.title || record.routeCode || record.id}」。`
      : `已驳回「${record.title || record.routeCode || record.id}」。`;
    auditDialogOpen.value = false;
    auditRecord.value = null;

    // 详情仍开着时同步列表最新态（收起底部「审核」）
    if (detailRecord.value?.id === record.id) {
      const latest = rows.value.find((item) => item.id === record.id);
      if (latest) {
        detailRecord.value = latest;
      }
      await refreshRouteDetail({ silent: true });
    }
  } catch (caughtError) {
    actionError.value = resolveActionErrorMessage(caughtError, '审核提交失败。');
  } finally {
    auditSubmitting.value = false;
    finishRowAction(record.id);
  }
};

const detailCanEdit = computed(() => {
  const record = detailRecord.value;
  if (!record) {
    return false;
  }
  return getRouteWorkflowActions(record, workflowContext.value).canEditContent;
});

const detailLockMessage = computed(() => {
  const record = detailRecord.value;
  if (!record || detailCanEdit.value) {
    return '';
  }
  return getEditLockMessage(record, workflowContext.value);
});

const detailActions = computed(() => {
  const record = detailRecord.value;
  if (!record) {
    return null;
  }
  return getRouteWorkflowActions(record, workflowContext.value);
});
</script>

<template>
  <div class="mx-auto flex w-full max-w-[1400px] flex-col gap-4">
    <div v-if="error" class="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      {{ error.message || '主题路线数据加载失败。' }}
    </div>
    <div v-if="createError" class="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      {{ createError }}
    </div>
    <div v-if="actionError" class="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      {{ actionError }}
    </div>
    <div v-if="actionFeedback" class="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
      {{ actionFeedback }}
    </div>

    <section class="warm-panel warm-outline rounded-xl border border-border/70 px-4 py-4">
      <div class="flex flex-wrap items-end gap-3">
        <div class="w-[240px] space-y-1.5">
          <label class="text-sm font-medium text-foreground">所属博物馆</label>
          <Select :model-value="selectedMuseumId" :disabled="museumPending || !museumOptions.length" @update:model-value="selectedMuseumId = $event">
            <option v-for="option in museumOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </Select>
        </div>
        <div class="min-w-[200px] flex-1 space-y-1.5">
          <label class="text-sm font-medium text-foreground">关键词</label>
          <Input v-model="filters.keyword" placeholder="搜索路线标题、编码、主题" />
        </div>
        <div class="w-[130px] space-y-1.5">
          <label class="text-sm font-medium text-foreground">发布状态</label>
          <Select :model-value="String(filters.publishStatus)" @update:model-value="filters.publishStatus = Number($event)">
            <option v-for="option in ROUTE_PUBLISH_STATUS_OPTIONS" :key="option.value" :value="String(option.value)">
              {{ option.label }}
            </option>
          </Select>
        </div>
        <div class="w-[130px] space-y-1.5">
          <label class="text-sm font-medium text-foreground">审核状态</label>
          <Select :model-value="String(filters.auditStatus)" @update:model-value="filters.auditStatus = Number($event)">
            <option v-for="option in ROUTE_AUDIT_STATUS_OPTIONS" :key="option.value" :value="String(option.value)">
              {{ option.label }}
            </option>
          </Select>
        </div>
        <div class="flex flex-wrap items-end gap-2 xl:ml-auto">
          <Button
            v-if="authStore.isAdmin"
            variant="outline"
            @click="setPendingAuditFilter">
            待审核
          </Button>
          <Button :disabled="!selectedMuseumId || createSubmitting" @click="createDialogOpen = true">
            <AppIcon name="route" class="h-4 w-4" />
            新增路线
          </Button>
          <Button variant="outline" @click="resetFilters">
            重置筛选
          </Button>
          <Button variant="outline" @click="refresh()">
            刷新
          </Button>
        </div>
      </div>
    </section>

    <section class="space-y-3">
      <div class="flex items-center justify-between gap-3 px-1">
        <div class="min-w-0 truncate text-sm text-muted-foreground">
          共 {{ total }} 条，当前第 {{ pageIndex }} / {{ Math.max(totalPages, 1) }} 页
          <span v-if="authStore.isGuide" class="text-muted-foreground/80"> · 显示自己的路线与已上架路线</span>
        </div>
        <div class="flex shrink-0 flex-nowrap items-center gap-2 text-sm text-muted-foreground">
          <span class="whitespace-nowrap">每页</span>
          <Select :model-value="String(pageSize)" class="w-[78px] shrink-0" @update:model-value="setPageSize(Number($event))">
            <option value="10">10</option>
            <option value="20">20</option>
            <option value="50">50</option>
          </Select>
          <Button variant="outline" class="shrink-0 whitespace-nowrap" :disabled="pageIndex <= 1 || pending" @click="setPage(pageIndex - 1)">
            上一页
          </Button>
          <Button variant="outline" class="shrink-0 whitespace-nowrap" :disabled="pageIndex >= Math.max(totalPages, 1) || pending" @click="setPage(pageIndex + 1)">
            下一页
          </Button>
        </div>
      </div>

      <RouteDataTable
        :rows="rows"
        :pending="pending"
        :sorting="sorting"
        :acting-ids="actionPendingIds"
        :workflow-context="workflowContext"
        @sort="toggleSort"
        @detail="handleDetail"
        @publish="handlePublish"
        @unpublish="handleUnpublish"
        @submit-audit="handleSubmitAudit"
        @refresh-row="refreshRouteRow"
        @remove="handleRemove" />
    </section>

    <RouteCreateDialog
      v-model:open="createDialogOpen"
      :museum-options="museumOptions"
      :default-museum-id="selectedMuseumId"
      :submitting="createSubmitting"
      @submit-manual="handleCreateManual"
      @route-changed="handleChatRouteChanged"
      @route-published="handleChatRoutePublished" />

    <!-- v-if + key：关闭即销毁内部状态；换路线强制重挂载 -->
    <RouteDetailDialog
      v-if="detailDialogOpen"
      :key="detailRecord?.id || 'route-detail'"
      :open="detailDialogOpen"
      :detail="routeDetail"
      :record="detailRecord"
      :pending="detailPending"
      :can-edit="detailCanEdit"
      :lock-message="detailLockMessage"
      :actions="detailActions"
      @update:open="onDetailDialogOpenChange"
      @refresh-silent="refreshRouteDetail({ silent: true })"
      @publish="detailRecord && handlePublish(detailRecord)"
      @unpublish="detailRecord && handleUnpublish(detailRecord)"
      @submit-audit="detailRecord && handleSubmitAudit(detailRecord)"
      @audit="detailRecord && handleAudit(detailRecord)" />

    <RouteAuditDialog
      v-if="auditDialogOpen"
      :key="auditRecord?.id || 'route-audit'"
      :open="auditDialogOpen"
      :record="auditRecord"
      :submitting="auditSubmitting"
      @update:open="onAuditDialogOpenChange"
      @confirm="submitAuditDecision" />

    <Dialog v-model:open="confirmDialogOpen">
      <DialogContent class="max-w-[min(92vw,24rem)] rounded-xl border border-border bg-[#15171b] p-0 text-left">
        <DialogHeader class="space-y-2 px-5 pb-2 pt-4">
          <DialogTitle>{{ confirmDialogTitle }}</DialogTitle>
          <DialogDescription>{{ confirmDialogDescription }}</DialogDescription>
        </DialogHeader>

        <DialogFooter class="px-5 pb-4 pt-3">
          <Button variant="outline" type="button" @click="resetConfirmDialog">
            取消
          </Button>
          <Button
            :variant="confirmActionType === 'delete' ? 'secondary' : 'default'"
            type="button"
            :disabled="!confirmRecord || actionPendingIds.includes(confirmRecord.id)"
            @click="submitConfirmedAction">
            {{ confirmActionLabel }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
