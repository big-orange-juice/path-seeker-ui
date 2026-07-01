<script setup lang="ts">
import { shallowRef } from 'vue';
import type { MuseumDraft, MuseumRecord } from '@/types/museum';

definePageMeta({
  middleware: 'admin-auth',
});

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
const workspaceTab = shallowRef<'basic' | 'floors' | 'galleries' | 'facilities'>('basic');

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

const handleSave = async (draft: MuseumDraft) => {
  submitting.value = true;

  try {
    const savedId = await saveDraft(draft, formMode.value === 'edit' ? activeRecordId.value : undefined);
    activeRecordId.value = savedId;
    formMode.value = 'edit';
    draftState.value = {
      ...draft,
      id: savedId,
    };
    if (workspaceTab.value === 'basic') {
      workspaceTab.value = 'floors';
    }
  } finally {
    submitting.value = false;
  }
};

const handleRemove = async (record: MuseumRecord) => {
  const confirmed = window.confirm(`确认删除主体“${record.name || record.museumCode || record.id}”吗？`);
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
  } finally {
    submitting.value = false;
  }
};
</script>

<template>
  <div class="mx-auto flex w-full max-w-[1400px] flex-col gap-4">
    <div v-if="error" class="rounded-[0.85rem] border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      {{ error.message || '主体数据加载失败。' }}
    </div>

    <section class="warm-panel warm-outline rounded-[0.95rem] border border-border/70 px-4 py-4">
      <div class="flex flex-wrap items-end gap-3">
        <div class="min-w-[280px] flex-1 space-y-2">
          <label class="text-sm font-medium text-foreground">关键词</label>
          <UiInput v-model="keyword" placeholder="搜索主体编码、名称、地址" />
        </div>
        <div class="w-[180px] space-y-2">
          <label class="text-sm font-medium text-foreground">状态筛选</label>
          <select
            v-model="status"
            class="h-9 w-full rounded-md border border-border bg-secondary px-3 text-sm text-foreground transition-colors duration-200 focus:border-primary/45 focus:bg-accent">
            <option :value="0">全部状态</option>
            <option :value="1">启用</option>
            <option :value="2">停用</option>
          </select>
        </div>

        <div class="flex flex-wrap items-end justify-start gap-2 xl:justify-end">
          <UiButton variant="outline" :disabled="submitting" @click="() => { keyword = ''; status = 0; }">
            重置筛选
          </UiButton>
          <UiButton :disabled="submitting" @click="startCreate">
            新增主体
          </UiButton>
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
