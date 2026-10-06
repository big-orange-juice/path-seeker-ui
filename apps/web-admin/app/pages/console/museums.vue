<script setup lang="ts">
import { shallowRef, watch } from 'vue';
import Button from '@/components/shadcn/button/Button.vue';
import Input from '@/components/shadcn/input/Input.vue';
import Select from '@/components/shadcn/select/Select.vue';
import { useActionFeedback } from '@/composables/useActionFeedback';
import type { MuseumDraft, MuseumRecord } from '@/types/museum';
import { isScenicVenue } from '@/utils/scenic-boundary';

definePageMeta({
  middleware: 'admin-auth',
});

const actionFeedback = useActionFeedback();
const {
  museums,
  pending,
  error,
  keyword,
  status,
  createEmptyDraft,
  createDraftFromRecord,
  saveDraft,
  deleteMuseum,
} = useMuseumManagement();

const formMode = shallowRef<'create' | 'edit'>('create');
const activeRecordId = shallowRef('');
const submitting = shallowRef(false);
const draftState = shallowRef<MuseumDraft>(createEmptyDraft());
const dialogOpen = shallowRef(false);
const detailDialogOpen = shallowRef(false);
const detailRecord = shallowRef<MuseumRecord | null>(null);
const workspaceTab = shallowRef<'basic' | 'floors' | 'facilities' | 'places'>('basic');

const startCreate = () => {
  formMode.value = 'create';
  activeRecordId.value = '';
  draftState.value = createEmptyDraft();
  workspaceTab.value = 'basic';
  dialogOpen.value = true;
};

const startEdit = (record: MuseumRecord) => {
  formMode.value = 'edit';
  activeRecordId.value = record.id;
  draftState.value = createDraftFromRecord(record);
  workspaceTab.value = 'basic';
  dialogOpen.value = true;
};

const openDetail = (record: MuseumRecord) => {
  detailRecord.value = record;
  detailDialogOpen.value = true;
};
/** 景点范围越界时跳转过来（/console/museums?museumId=..&focus=boundary&ref=lng,lat;..） */
const route = useRoute();
const boundaryReference = shallowRef<{ longitude: number; latitude: number }[]>([]);
let boundaryDeepLinkHandled = false;

const parseBoundaryReference = (value: unknown) => String(value || '')
  .split(';')
  .map(item => item.split(',').map(Number))
  .filter(pair => pair.length === 2 && Number.isFinite(pair[0]) && Number.isFinite(pair[1]))
  .map(pair => ({ longitude: pair[0] as number, latitude: pair[1] as number }));

// 列表是异步加载的，等拿到记录后再按 query 打开编辑表单；只处理一次，避免保存后重复弹出
watch(museums, rows => {
  if (boundaryDeepLinkHandled) return;
  const targetId = String(route.query.museumId || '').trim();
  if (!targetId || dialogOpen.value) return;
  const record = rows.find(item => item.id === targetId);
  if (!record) return;
  boundaryDeepLinkHandled = true;
  boundaryReference.value = parseBoundaryReference(route.query.ref);
  startEdit(record);
}, { immediate: true });

const handleSave = async (draft: MuseumDraft) => {
  submitting.value = true;
  const wasEdit = formMode.value === 'edit';

  try {
    const savedId = await saveDraft(draft, wasEdit ? activeRecordId.value : undefined);
    activeRecordId.value = savedId;
    formMode.value = 'edit';
    draftState.value = {
      ...draft,
      id: savedId,
    };
    if (workspaceTab.value === 'basic') {
      workspaceTab.value = isScenicVenue(draftState.value.venueType) ? 'places' : 'floors';
    }
    const label = isScenicVenue(draft.venueType) ? '景点' : '博物馆';
    actionFeedback.success(wasEdit ? `${label}已保存。` : `${label}已创建。`);
  } catch (caughtError) {
    actionFeedback.errorFrom(caughtError, '景点或博物馆保存失败。');
  } finally {
    submitting.value = false;
  }
};

const handleRemove = async (record: MuseumRecord) => {
  const confirmed = window.confirm(`确认删除博物馆“${record.name || record.museumCode || record.id}”吗？`);
  if (!confirmed) {
    return;
  }

  submitting.value = true;

  try {
    await deleteMuseum(record.id);
    if (activeRecordId.value === record.id) {
      dialogOpen.value = false;
      formMode.value = 'create';
      activeRecordId.value = '';
      draftState.value = createEmptyDraft();
    }
    actionFeedback.success('博物馆已删除。');
  } catch (caughtError) {
    actionFeedback.errorFrom(caughtError, '博物馆删除失败。');
  } finally {
    submitting.value = false;
  }
};
</script>

<template>
  <div class="admin-page-frame flex flex-col gap-4">
    <div v-if="error" class="rounded-[0.85rem] border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      {{ error.message || '博物馆数据加载失败。' }}
    </div>    <div v-if="boundaryReference.length" class="rounded-[0.85rem] border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
      <p class="font-medium">需要把本次目的地的边界扩大到覆盖以下参考坐标（WGS84）</p>
      <p class="mt-1 break-all font-mono text-xs">{{ boundaryReference.map(point => `${point.longitude.toFixed(6)},${point.latitude.toFixed(6)}`).join('  ') }}</p>
      <p class="mt-1 text-xs text-muted-foreground">改完目的地边界并保存后，回到景点范围编辑页重新保存范围即可；越界的范围此前未落库，草稿仍在原页面。</p>
    </div>

    <section class="warm-panel warm-outline rounded-[0.95rem] border border-border/70 px-4 py-4">
      <div class="flex flex-wrap items-end gap-3">
        <div class="min-w-[280px] flex-1 space-y-2">
          <label class="text-sm font-medium">关键词</label>
          <Input v-model="keyword" placeholder="搜索博物馆名称、编码、地址" />
        </div>
        <div class="w-[180px] space-y-2">
          <label class="text-sm font-medium">状态筛选</label>
          <Select :model-value="String(status)" @update:model-value="status = Number($event)">
            <option value="0">全部状态</option>
            <option value="1">启用</option>
            <option value="2">停用</option>
          </Select>
        </div>

        <div class="flex flex-wrap items-end justify-start gap-2 xl:justify-end">
          <Button variant="outline" :disabled="submitting" @click="() => { keyword = ''; status = 0; }">
            重置筛选
          </Button>
          <Button :disabled="submitting" @click="startCreate">
            新增景点
          </Button>
        </div>
      </div>
    </section>

    <section class="grid gap-4">
      <MuseumManagementTable
        :museums="museums"
        :active-id="activeRecordId"
        :pending="pending"
        @detail="openDetail"
        @edit="startEdit"
        @remove="handleRemove" />
    </section>

    <MuseumManagementWorkspaceDialog
      v-model:active-tab="workspaceTab"
      :open="dialogOpen"
      :mode="formMode"
      :initial-value="draftState"
      :submitting="submitting"
      @update:open="dialogOpen = $event"
      @save="handleSave" />

    <MuseumManagementDetailDialog
      :open="detailDialogOpen"
      :record="detailRecord"
      @update:open="detailDialogOpen = $event" />
  </div>
</template>
