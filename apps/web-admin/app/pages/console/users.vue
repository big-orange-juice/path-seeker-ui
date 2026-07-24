<script setup lang="ts">
import { onMounted, shallowRef } from 'vue';
import UserDataTable from '@/components/users/UserDataTable.vue';
import UserFormDialog from '@/components/users/UserFormDialog.vue';
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
import { useActionFeedback } from '@/composables/useActionFeedback';
import { useAdminUserManagement } from '@/composables/useAdminUserManagement';
import { useAdminAuthStore } from '@/stores/adminAuth';
import {
  ADMIN_USER_STATUS_OPTIONS,
  createAdminUserDraftFromRecord,
  createEmptyAdminUserDraft,
  type AdminUserDraft,
  type AdminUserRecord,
} from '@/types/admin-user';

definePageMeta({
  middleware: 'admin-auth',
});

const authStore = useAdminAuthStore();
const actionFeedback = useActionFeedback();

const {
  keyword,
  status,
  roleId,
  pageIndex,
  pageSize,
  rows,
  total,
  totalPages,
  pending,
  error,
  rolesPending,
  roleOptions,
  fetchRoles,
  refresh,
  setPage,
  setPageSize,
  resetFilters,
  createAdmin,
  updateAdmin,
  deleteAdmin,
  toggleStatus,
  forceResetPassword,
} = useAdminUserManagement();

const formOpen = shallowRef(false);
const formMode = shallowRef<'create' | 'edit'>('create');
const formDraft = shallowRef<AdminUserDraft>(createEmptyAdminUserDraft());
const formSubmitting = shallowRef(false);

const deleteOpen = shallowRef(false);
const deleteRecord = shallowRef<AdminUserRecord | null>(null);

const resetOpen = shallowRef(false);
const resetRecord = shallowRef<AdminUserRecord | null>(null);
const resetPassword = shallowRef('');
const resetSubmitting = shallowRef(false);

const actionPendingIds = shallowRef<string[]>([]);

const startActing = (id: string) => {
  if (!actionPendingIds.value.includes(id)) {
    actionPendingIds.value = [...actionPendingIds.value, id];
  }
};

const finishActing = (id: string) => {
  actionPendingIds.value = actionPendingIds.value.filter((item) => item !== id);
};

onMounted(() => {
  void fetchRoles();
});

const startCreate = () => {
  formMode.value = 'create';
  formDraft.value = createEmptyAdminUserDraft();
  formOpen.value = true;
};

const startEdit = (record: AdminUserRecord) => {
  formMode.value = 'edit';
  formDraft.value = createAdminUserDraftFromRecord(record);
  formOpen.value = true;
};

const handleFormSubmit = async (draft: AdminUserDraft) => {
  formSubmitting.value = true;
  try {
    if (formMode.value === 'create') {
      await createAdmin(draft);
      actionFeedback.success('用户已创建。');
    } else {
      await updateAdmin(draft);
      actionFeedback.success('用户资料已更新。');
    }
    formOpen.value = false;
    await refresh();
  } catch (caught) {
    actionFeedback.errorFrom(caught, formMode.value === 'create' ? '创建用户失败。' : '更新用户失败。');
  } finally {
    formSubmitting.value = false;
  }
};

const askRemove = (record: AdminUserRecord) => {
  deleteRecord.value = record;
  deleteOpen.value = true;
};

const submitRemove = async () => {
  const record = deleteRecord.value;
  if (!record) return;

  startActing(record.id);
  try {
    await deleteAdmin(record.id);
    deleteOpen.value = false;
    deleteRecord.value = null;
    actionFeedback.success('用户已删除。');
    await refresh();
  } catch (caught) {
    actionFeedback.errorFrom(caught, '删除用户失败。');
  } finally {
    finishActing(record.id);
  }
};

const handleToggleStatus = async (record: AdminUserRecord) => {
  startActing(record.id);
  try {
    await toggleStatus(record);
    actionFeedback.success(record.status === 1 ? '用户已禁用。' : '用户已启用。');
    await refresh();
  } catch (caught) {
    actionFeedback.errorFrom(caught, '更新状态失败。');
  } finally {
    finishActing(record.id);
  }
};

const openResetPassword = (record: AdminUserRecord) => {
  resetRecord.value = record;
  resetPassword.value = '';
  resetOpen.value = true;
};

const submitResetPassword = async () => {
  const record = resetRecord.value;
  if (!record) return;

  const nextPassword = resetPassword.value.trim();
  if (nextPassword.length < 6) {
    actionFeedback.error('新密码至少 6 位。', '无法重置');
    return;
  }

  resetSubmitting.value = true;
  startActing(record.id);
  try {
    await forceResetPassword(record.id, nextPassword);
    resetOpen.value = false;
    resetRecord.value = null;
    resetPassword.value = '';
    actionFeedback.success('密码已重置。');
  } catch (caught) {
    actionFeedback.errorFrom(caught, '重置密码失败。');
  } finally {
    resetSubmitting.value = false;
    finishActing(record.id);
  }
};
</script>

<template>
  <div class="mx-auto flex w-full max-w-[1400px] flex-col gap-4">
    <div
      v-if="error"
      class="rounded-[0.85rem] border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
    >
      {{ error.message || '用户数据加载失败。' }}
    </div>

    <section class="warm-panel warm-outline rounded-[0.95rem] border border-border/70 px-4 py-4">
      <div class="flex flex-wrap items-end gap-3">
        <div class="min-w-[220px] flex-1 space-y-1.5">
          <label class="text-sm font-medium">关键词</label>
          <Input v-model="keyword" placeholder="用户名 / 姓名 / 手机 / 邮箱" />
        </div>
        <div class="w-[140px] space-y-1.5">
          <label class="text-sm font-medium">状态</label>
          <Select :model-value="String(status)" @update:model-value="status = Number($event)">
            <option
              v-for="option in ADMIN_USER_STATUS_OPTIONS"
              :key="option.value"
              :value="String(option.value)"
            >
              {{ option.label }}
            </option>
          </Select>
        </div>
        <div class="w-[160px] space-y-1.5">
          <label class="text-sm font-medium">角色</label>
          <Select
            :model-value="roleId"
            :disabled="rolesPending"
            @update:model-value="roleId = $event"
          >
            <option value="">全部角色</option>
            <option v-for="option in roleOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </Select>
        </div>
        <div class="flex flex-wrap items-end gap-2 xl:ml-auto">
          <Button type="button" @click="startCreate">
            <AppIcon name="user-round" class="h-4 w-4" />
            新增用户
          </Button>
          <Button variant="outline" type="button" @click="resetFilters">
            重置筛选
          </Button>
          <Button variant="outline" type="button" @click="refresh()">
            刷新
          </Button>
        </div>
      </div>
    </section>

    <section class="space-y-3">
      <div class="flex items-center justify-between gap-3 px-1">
        <div class="min-w-0 truncate text-sm text-muted-foreground">
          共 {{ total }} 条，当前第 {{ pageIndex }} / {{ Math.max(totalPages, 1) }} 页
        </div>
        <div class="flex shrink-0 flex-nowrap items-center gap-2 text-sm text-muted-foreground">
          <span class="whitespace-nowrap">每页</span>
          <Select
            :model-value="String(pageSize)"
            class="w-[78px] shrink-0"
            @update:model-value="setPageSize(Number($event))"
          >
            <option value="10">10</option>
            <option value="20">20</option>
            <option value="50">50</option>
          </Select>
          <Button
            variant="outline"
            class="shrink-0 whitespace-nowrap"
            :disabled="pageIndex <= 1 || pending"
            @click="setPage(pageIndex - 1)"
          >
            上一页
          </Button>
          <Button
            variant="outline"
            class="shrink-0 whitespace-nowrap"
            :disabled="pageIndex >= Math.max(totalPages, 1) || pending"
            @click="setPage(pageIndex + 1)"
          >
            下一页
          </Button>
        </div>
      </div>

      <UserDataTable
        :rows="rows"
        :pending="pending"
        :acting-ids="actionPendingIds"
        :current-admin-id="authStore.adminId"
        @edit="startEdit"
        @remove="askRemove"
        @toggle-status="handleToggleStatus"
        @reset-password="openResetPassword"
      />
    </section>

    <UserFormDialog
      v-model:open="formOpen"
      :mode="formMode"
      :initial-value="formDraft"
      :role-options="roleOptions"
      :roles-pending="rolesPending"
      :submitting="formSubmitting"
      @submit="handleFormSubmit"
    />

    <Dialog v-model:open="deleteOpen">
      <DialogContent class="max-w-[min(92vw,24rem)] rounded-xl border border-border bg-[#15171b] p-0 text-left">
        <DialogHeader class="space-y-2 px-5 pb-2 pt-4">
          <DialogTitle>删除用户</DialogTitle>
          <DialogDescription>
            确认删除「{{ deleteRecord?.username || deleteRecord?.realName || '该用户' }}」吗？此操作不可撤销。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter class="px-5 pb-4 pt-3">
          <Button variant="outline" type="button" @click="deleteOpen = false">
            取消
          </Button>
          <Button
            variant="secondary"
            type="button"
            :disabled="!deleteRecord || actionPendingIds.includes(deleteRecord.id)"
            @click="submitRemove"
          >
            确认删除
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="resetOpen">
      <DialogContent class="max-w-[min(92vw,24rem)] rounded-xl border border-border bg-[#15171b] p-0 text-left">
        <DialogHeader class="space-y-2 px-5 pb-2 pt-4">
          <DialogTitle>重置密码</DialogTitle>
          <DialogDescription>
            为「{{ resetRecord?.username || '该用户' }}」设置新密码（至少 6 位）。
          </DialogDescription>
        </DialogHeader>
        <div class="px-5 py-2">
          <Input
            v-model="resetPassword"
            type="password"
            placeholder="新密码"
            autocomplete="new-password"
          />
        </div>
        <DialogFooter class="px-5 pb-4 pt-3">
          <Button variant="outline" type="button" :disabled="resetSubmitting" @click="resetOpen = false">
            取消
          </Button>
          <Button type="button" :disabled="resetSubmitting" @click="submitResetPassword">
            {{ resetSubmitting ? '提交中…' : '确认重置' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
