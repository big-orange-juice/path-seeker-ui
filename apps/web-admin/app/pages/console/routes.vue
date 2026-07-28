<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue';
import RouteAuditDialog from '@/components/routes/RouteAuditDialog.vue';
import RouteCreateDialog from '@/components/routes/RouteCreateDialog.vue';
import RouteDataTable from '@/components/routes/RouteDataTable.vue';
import RouteDetailDialog from '@/components/routes/RouteDetailDialog.vue';
import RoutePosterDialog from '@/components/routes/RoutePosterDialog.vue';
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
import { useActionFeedback } from '@/composables/useActionFeedback';
import { useAdminAuthStore } from '@/stores/adminAuth';
import type { BuildRouteFromThemePayload, RouteDetailResponse, RouteRecord } from '@/types/route';
import type { MuseumResponse, MuseumResponseListTotalPageResult } from '@/types/museum';

definePageMeta({
  middleware: 'admin-auth',
});

const authStore = useAdminAuthStore();
const actionFeedback = useActionFeedback();
const selectedMuseumId = shallowRef('');
const { request } = useApiClient();
const createDialogOpen = shallowRef(false);
const createSubmitting = shallowRef(false);
const actionPendingIds = shallowRef<string[]>([]);
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
const publishAfterAuditOpen = shallowRef(false);
const publishAfterAuditRecord = shallowRef<RouteRecord | null>(null);
const posterDialogOpen = shallowRef(false);
const posterRecord = shallowRef<RouteRecord | null>(null);

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
      // 下拉默认只展示名称；编码留给详情/表单（G-04）
      label: String(museum.name || museum.museumCode || museum.id).trim() || String(museum.id),
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

  try {
    await request<string>('/api/route/build-from-theme', {
      method: 'POST',
      body: payload,
    });
    createDialogOpen.value = false;
    await refresh();
    actionFeedback.success('主题路线已生成。');
  } catch (caughtError) {
    actionFeedback.errorFrom(caughtError, '主题路线创建失败。');
  } finally {
    createSubmitting.value = false;
  }
};

const handleChatRouteChanged = async (_routeId: string) => {
  try {
    await refresh();
  } catch (caughtError) {
    actionFeedback.errorFrom(caughtError, '路线列表刷新失败。');
  }
};

const handleChatRoutePublished = async (routeId: string) => {
  actionFeedback.success('路线状态已更新。');
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
      return authStore.isAdmin
        ? `确认删除「${routeName}」吗？未上架路线删除后不可恢复。`
        : `确认删除「${routeName}」吗？仅未上架且非待审的本人路线可删，删除后不可恢复。`;
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

const handlePoster = (record: RouteRecord) => {
  posterRecord.value = record;
  posterDialogOpen.value = true;
};

const onPosterDialogOpenChange = (value: boolean) => {
  posterDialogOpen.value = value;
  if (!value) {
    posterRecord.value = null;
  }
};

const handleDetail = async (record: RouteRecord) => {
  const actions = getRouteWorkflowActions(record, workflowContext.value);
  if (!actions.canOpenDetail) {
    actionFeedback.error(
      actions.isListOnly
        ? '该路线暂不可打开详情，请先在列表完成审核或上架相关操作。'
        : '暂时不能查看该路线详情。',
      '无法打开',
    );
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
    actionFeedback.errorFrom(caughtError, '主题路线详情获取失败。');
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
  startRowAction(record.id);

  try {
    await refresh();
    actionFeedback.success(`已刷新「${record.title || record.routeCode || record.id}」。`);
  } catch (caughtError) {
    actionFeedback.errorFrom(caughtError, '主题路线刷新失败。');
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

  try {
    routeDetail.value = await fetchRouteDetail(record.id);
    // 同步列表行状态，保持详情工具栏与锁一致
    const latest = rows.value.find((item) => item.id === record.id);
    if (latest) {
      detailRecord.value = latest;
    }
  } catch (caughtError) {
    if (!silent) {
      actionFeedback.errorFrom(caughtError, '主题路线详情刷新失败。');
    }
  } finally {
    if (!silent) {
      detailPending.value = false;
    }
  }
};

const handleRouteTitleSaved = async (title: string) => {
  const record = detailRecord.value;
  if (!record) return;

  detailRecord.value = { ...record, title };
  if (routeDetail.value?.route) {
    routeDetail.value = {
      ...routeDetail.value,
      route: { ...routeDetail.value.route, title },
    };
  }

  try {
    await refresh();
  } catch (caughtError) {
    actionFeedback.errorFrom(caughtError, '路线标题已保存，但列表刷新失败。');
  }
};
const assertWorkflowAction = (
  record: RouteRecord,
  key: 'canPublish' | 'canUnpublish' | 'canSubmitAudit' | 'canAudit' | 'canDelete' | 'canEditContent',
  deniedMessage: string,
) => {
  const actions = getRouteWorkflowActions(record, workflowContext.value);
  if (!actions[key]) {
    actionFeedback.error(deniedMessage, '无法操作');
    return false;
  }
  return true;
};

const handlePublish = (record: RouteRecord) => {
  if (!assertWorkflowAction(record, 'canPublish', '暂时不能上架，请先完成审核或确认路线归属。')) {
    return;
  }
  openConfirmDialog('publish', record);
};

const handleUnpublish = (record: RouteRecord) => {
  if (!assertWorkflowAction(record, 'canUnpublish', '暂时不能下线该路线。')) {
    return;
  }
  openConfirmDialog('unpublish', record);
};

const handleSubmitAudit = (record: RouteRecord) => {
  if (!assertWorkflowAction(record, 'canSubmitAudit', '暂时不能提交审核，请确认路线状态与归属。')) {
    return;
  }
  openConfirmDialog('submit-audit', record);
};

const handleAudit = (record: RouteRecord) => {
  if (!assertWorkflowAction(record, 'canAudit', '暂时不能审核该路线。')) {
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
  if (!assertWorkflowAction(record, 'canDelete', '暂时不能删除该路线。')) {
    return;
  }
  openConfirmDialog('delete', record);
};

const submitConfirmedAction = async () => {
  const record = confirmRecord.value;
  if (!record) {
    return;
  }

  startRowAction(record.id);

  try {
    if (confirmActionType.value === 'publish') {
      await publishRoute({
        id: record.id,
        publishStatus: PUBLISH_ONLINE,
      });
      actionFeedback.success(`已上架「${record.title || record.routeCode || record.id}」。`);
    } else if (confirmActionType.value === 'unpublish') {
      await publishRoute({
        id: record.id,
        publishStatus: PUBLISH_OFFLINE,
      });
      actionFeedback.success(`已下线「${record.title || record.routeCode || record.id}」。`);
    } else if (confirmActionType.value === 'submit-audit') {
      await submitAudit({ id: record.id });
      actionFeedback.success(`已提交审核「${record.title || record.routeCode || record.id}」。`);
    } else {
      await deleteRoute(record.id);
      actionFeedback.success(`已删除「${record.title || record.routeCode || record.id}」。`);
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
    actionFeedback.errorFrom(caughtError, fallback);
  } finally {
    finishRowAction(record.id);
  }
};

const submitAuditDecision = async (payload: { pass: boolean; remark: string }) => {
  const record = auditRecord.value;
  if (!record) {
    return;
  }

  auditSubmitting.value = true;
  startRowAction(record.id);

  try {
    await auditRoute({
      id: record.id,
      pass: payload.pass,
      remark: payload.remark || null,
    });
    actionFeedback.success(
      payload.pass
        ? `已通过「${record.title || record.routeCode || record.id}」。`
        : `已驳回「${record.title || record.routeCode || record.id}」。`,
    );
    auditDialogOpen.value = false;
    auditRecord.value = null;
    if (payload.pass) {
      publishAfterAuditRecord.value = record;
      publishAfterAuditOpen.value = true;
    }

    // 详情仍开着时同步列表最新态（收起底部「审核」）
    if (detailRecord.value?.id === record.id) {
      const latest = rows.value.find((item) => item.id === record.id);
      if (latest) {
        detailRecord.value = latest;
      }
      await refreshRouteDetail({ silent: true });
    }
  } catch (caughtError) {
    actionFeedback.errorFrom(caughtError, '审核提交失败。');
  } finally {
    auditSubmitting.value = false;
    finishRowAction(record.id);
  }
};

const publishApprovedRoute = async () => {
  const record = publishAfterAuditRecord.value
  if (!record) return

  startRowAction(record.id)
  try {
    await publishRoute({ id: record.id, publishStatus: PUBLISH_ONLINE })
    actionFeedback.success(`已上架「${record.title || record.routeCode || record.id}」。`)
    publishAfterAuditOpen.value = false
    publishAfterAuditRecord.value = null
  } catch (caughtError) {
    actionFeedback.errorFrom(caughtError, '主题路线上架失败。')
  } finally {
    finishRowAction(record.id)
  }
}

const closePublishAfterAuditDialog = () => {
  publishAfterAuditOpen.value = false
  publishAfterAuditRecord.value = null
}
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
    <section class="warm-panel warm-outline rounded-xl border border-border/70 px-4 py-4">
      <div class="flex flex-wrap items-end gap-3">
        <div class="w-[240px] space-y-1.5">
          <label class="text-sm font-medium">所属博物馆</label>
          <Select :model-value="selectedMuseumId" :disabled="museumPending || !museumOptions.length" @update:model-value="selectedMuseumId = $event">
            <option v-for="option in museumOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </Select>
        </div>
        <div class="min-w-[200px] flex-1 space-y-1.5">
          <label class="text-sm font-medium">关键词</label>
          <Input v-model="filters.keyword" placeholder="搜索路线标题、编码、主题" />
        </div>
        <div class="w-[160px] space-y-1.5">
          <label class="text-sm font-medium">创建人</label>
          <Input v-model="filters.ownerName" placeholder="导游姓名/用户名" />
        </div>
        <div class="w-[130px] space-y-1.5">
          <label class="text-sm font-medium">发布状态</label>
          <Select :model-value="String(filters.publishStatus)" @update:model-value="filters.publishStatus = Number($event)">
            <option v-for="option in ROUTE_PUBLISH_STATUS_OPTIONS" :key="option.value" :value="String(option.value)">
              {{ option.label }}
            </option>
          </Select>
        </div>
        <div class="w-[130px] space-y-1.5">
          <label class="text-sm font-medium">审核状态</label>
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
          <span v-if="authStore.isGuide" class="text-muted-foreground/80"> · 你创建的路线，以及已上架可参考的路线</span>
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
        @poster="handlePoster"
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
      @title-saved="handleRouteTitleSaved"
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

    <Dialog :open="publishAfterAuditOpen" @update:open="(open) => !open && closePublishAfterAuditDialog()">
      <DialogContent class="max-w-[min(92vw,24rem)] rounded-xl border border-border bg-[#15171b] p-0 text-left">
        <DialogHeader class="space-y-2 px-5 pb-2 pt-4">
          <DialogTitle>审核已通过</DialogTitle>
          <DialogDescription>该路线已满足上架条件，是否现在上架？</DialogDescription>
        </DialogHeader>
        <DialogFooter class="px-5 pb-4 pt-3">
          <Button variant="outline" type="button" @click="closePublishAfterAuditDialog">稍后</Button>
          <Button type="button" :disabled="!publishAfterAuditRecord || actionPendingIds.includes(publishAfterAuditRecord.id)" @click="publishApprovedRoute">立即上架</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <RoutePosterDialog
      v-if="posterDialogOpen"
      :key="posterRecord?.id || 'route-poster'"
      :open="posterDialogOpen"
      :record="posterRecord"
      @update:open="onPosterDialogOpenChange" />

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
