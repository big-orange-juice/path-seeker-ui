<script setup lang="ts">
import { onMounted, ref, shallowRef } from 'vue';
import AppUserTable from '@/components/app-users/AppUserTable.vue';
import DriverPermissionDialog from '@/components/app-users/DriverPermissionDialog.vue';
import Button from '@/components/shadcn/button/Button.vue';
import Input from '@/components/shadcn/input/Input.vue';
import Select from '@/components/shadcn/select/Select.vue';
import { useAppUserManagement } from '@/composables/useAppUserManagement';
import { resolveApiErrorMessage } from '@/composables/useApiClient';
import { useActionFeedback } from '@/composables/useActionFeedback';
import { useAdminAuthStore } from '@/stores/adminAuth';
import type { AppUserRecord, DriverPermissionDraft } from '@/types/app-user';

definePageMeta({ middleware: 'admin-auth' });
const auth = useAdminAuthStore();
const feedback = useActionFeedback();
const feature = useAppUserManagement();
const { keyword, status, isDriver, rows, total, totalPages, pageIndex, pending, saving, error } = feature;
const selected = shallowRef<AppUserRecord | null>(null);
const formOpen = ref(false);
const formError = ref('');
onMounted(() => { if (auth.isAdmin) void feature.refresh(); });
const edit = (record: AppUserRecord) => {
  selected.value = record;
  formError.value = '';
  formOpen.value = true;
};
const save = async (draft: DriverPermissionDraft) => {
  formError.value = '';
  try {
    await feature.saveDriver(draft);
    formOpen.value = false;
    feedback.success(draft.isDriver ? '已授予车夫权限' : '已撤销车夫权限');
    await feature.refresh(pageIndex.value);
  } catch (caught) {
    formError.value = resolveApiErrorMessage(caught, '车夫权限保存失败');
  }
};
</script>

<template>
  <div v-if="auth.isAdmin" class="admin-page-frame flex flex-col gap-4">
    <p v-if="error" role="alert" class="text-sm text-destructive">{{ error }}</p>
    <form class="warm-panel flex flex-wrap items-end gap-3 rounded-lg border border-border/70 p-4" @submit.prevent="feature.refresh()">
      <label class="grid min-w-52 flex-1 gap-2 text-sm">关键词<Input v-model="keyword" placeholder="手机号 / 昵称 / 账号编号" /></label>
      <label class="grid w-32 gap-2 text-sm">状态<Select v-model="status"><option value="">全部</option><option value="1">正常</option><option value="2">禁用</option><option value="3">注销</option></Select></label>
      <label class="grid w-32 gap-2 text-sm">是否车夫<Select v-model="isDriver"><option value="">全部</option><option value="true">是</option><option value="false">否</option></Select></label>
      <Button type="submit" :disabled="pending || saving">查询</Button>
      <Button type="button" variant="outline" :disabled="pending || saving" @click="feature.refresh(pageIndex)">刷新</Button>
    </form>
    <AppUserTable :rows="rows" :pending="pending" :disabled="saving" @edit="edit" />
    <div class="flex items-center justify-end gap-3 text-sm text-muted-foreground"><span>共 {{ total }} 条 · 第 {{ pageIndex }} / {{ totalPages }} 页</span><Button variant="outline" :disabled="pending || saving || pageIndex <= 1" @click="feature.refresh(pageIndex - 1)">上一页</Button><Button variant="outline" :disabled="pending || saving || pageIndex >= totalPages" @click="feature.refresh(pageIndex + 1)">下一页</Button></div>
    <DriverPermissionDialog v-model:open="formOpen" :record="selected" :saving="saving" :error="formError" @save="save" />
  </div>
  <p v-else class="p-4 text-sm text-muted-foreground">C端用户管理仅对管理员开放。</p>
</template>
