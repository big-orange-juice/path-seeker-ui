<script setup lang="ts">
import { computed, reactive, shallowRef, watch } from 'vue';
import Button from '@/components/shadcn/button/Button.vue';
import Dialog from '@/components/shadcn/dialog/Dialog.vue';
import DialogContent from '@/components/shadcn/dialog/DialogContent.vue';
import DialogDescription from '@/components/shadcn/dialog/DialogDescription.vue';
import DialogFooter from '@/components/shadcn/dialog/DialogFooter.vue';
import DialogHeader from '@/components/shadcn/dialog/DialogHeader.vue';
import DialogTitle from '@/components/shadcn/dialog/DialogTitle.vue';
import Input from '@/components/shadcn/input/Input.vue';
import Select from '@/components/shadcn/select/Select.vue';
import type { AdminUserDraft } from '@/types/admin-user';
import { createEmptyAdminUserDraft } from '@/types/admin-user';

interface RoleOption {
  value: string;
  label: string;
}

interface Props {
  open: boolean;
  mode: 'create' | 'edit';
  initialValue: AdminUserDraft;
  roleOptions: RoleOption[];
  rolesPending?: boolean;
  submitting?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  rolesPending: false,
  submitting: false,
});

const emit = defineEmits<{
  'update:open': [value: boolean];
  submit: [draft: AdminUserDraft];
}>();

const form = reactive<AdminUserDraft>(createEmptyAdminUserDraft());
const localError = shallowRef('');

const isOpen = computed({
  get: () => props.open,
  set: (value: boolean) => emit('update:open', value),
});

const title = computed(() => (props.mode === 'create' ? '新增用户' : '编辑用户'));
const description = computed(() =>
  props.mode === 'create' ? '创建后台管理员账号并分配角色。' : '更新资料与角色，用户名不可修改。',
);

const canSubmit = computed(() => {
  if (!form.roleId.trim()) return false;
  if (props.mode === 'create') {
    return Boolean(form.username.trim() && form.password.trim().length >= 6);
  }
  return Boolean(form.id.trim());
});

watch(
  () => [props.open, props.initialValue] as const,
  ([open]) => {
    if (!open) return;
    Object.assign(form, createEmptyAdminUserDraft(), props.initialValue);
    localError.value = '';
  },
  { immediate: true, deep: true },
);

const handleSubmit = () => {
  localError.value = '';
  if (props.mode === 'create' && form.password.trim().length < 6) {
    localError.value = '密码至少 6 位。';
    return;
  }
  if (!form.roleId.trim()) {
    localError.value = '请选择角色。';
    return;
  }
  if (props.mode === 'create' && !form.username.trim()) {
    localError.value = '请填写用户名。';
    return;
  }

  emit('submit', {
    ...form,
    username: form.username.trim(),
    password: form.password,
    realName: form.realName.trim(),
    phone: form.phone.trim(),
    email: form.email.trim(),
    roleId: form.roleId.trim(),
  });
};
</script>

<template>
  <Dialog v-model:open="isOpen">
    <DialogContent class="flex max-h-[var(--admin-dialog-max-height)] max-w-[min(92vw,32rem)] flex-col overflow-hidden rounded-xl border border-border bg-[#15171b] p-0">
      <DialogHeader class="shrink-0 space-y-1 px-5 pb-2 pt-4 pr-12">
        <DialogTitle class="text-base">{{ title }}</DialogTitle>
        <DialogDescription class="text-xs">{{ description }}</DialogDescription>
      </DialogHeader>

      <div class="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-3">
        <p v-if="localError" class="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {{ localError }}
        </p>

        <div class="grid gap-3 sm:grid-cols-2">
          <div class="space-y-1.5 sm:col-span-2">
            <label class="text-sm font-medium">用户名</label>
            <Input
              v-model="form.username"
              :disabled="props.mode === 'edit' || props.submitting"
              placeholder="登录用户名"
            />
          </div>

          <div v-if="props.mode === 'create'" class="space-y-1.5 sm:col-span-2">
            <label class="text-sm font-medium">初始密码</label>
            <Input
              v-model="form.password"
              type="password"
              :disabled="props.submitting"
              placeholder="至少 6 位"
              autocomplete="new-password"
            />
          </div>

          <div class="space-y-1.5">
            <label class="text-sm font-medium">真实姓名</label>
            <Input v-model="form.realName" :disabled="props.submitting" placeholder="可选" />
          </div>

          <div class="space-y-1.5">
            <label class="text-sm font-medium">角色</label>
            <Select
              v-model="form.roleId"
              :disabled="props.rolesPending || !props.roleOptions.length || props.submitting"
            >
              <option value="" disabled>
                {{ props.rolesPending ? '加载中…' : '请选择角色' }}
              </option>
              <option v-for="option in props.roleOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </Select>
          </div>

          <div class="space-y-1.5">
            <label class="text-sm font-medium">手机号</label>
            <Input v-model="form.phone" :disabled="props.submitting" placeholder="可选" />
          </div>

          <div class="space-y-1.5">
            <label class="text-sm font-medium">邮箱</label>
            <Input v-model="form.email" :disabled="props.submitting" placeholder="可选" />
          </div>
        </div>
      </div>

      <DialogFooter class="shrink-0 px-5 pb-4 pt-2">
        <Button variant="outline" type="button" :disabled="props.submitting" @click="isOpen = false">
          取消
        </Button>
        <Button type="button" :disabled="props.submitting || !canSubmit" @click="handleSubmit">
          {{ props.submitting ? '提交中…' : '保存' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
