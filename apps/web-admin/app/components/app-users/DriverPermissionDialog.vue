<script setup lang="ts">
import { ref, watch } from 'vue';
import Button from '@/components/shadcn/button/Button.vue';
import Dialog from '@/components/shadcn/dialog/Dialog.vue';
import DialogContent from '@/components/shadcn/dialog/DialogContent.vue';
import DialogTitle from '@/components/shadcn/dialog/DialogTitle.vue';
import Input from '@/components/shadcn/input/Input.vue';
import type { AppUserRecord, DriverPermissionDraft } from '@/types/app-user';

const props = defineProps<{ record: AppUserRecord | null; saving: boolean; error: string }>();
const open = defineModel<boolean>('open', { default: false });
const emit = defineEmits<{ save: [draft: DriverPermissionDraft] }>();
const isDriver = ref(false);
const phone = ref('');
const updateOpen = (value: unknown) => {
  if (!props.saving && typeof value === 'boolean') open.value = value;
};
watch(open, (visible) => {
  if (!visible) return;
  isDriver.value = props.record?.isDriver ?? false;
  phone.value = props.record?.phone || '';
});
const submit = () => {
  if (!props.record || props.saving) return;
  emit('save', { userId: props.record.id, isDriver: isDriver.value, phone: phone.value });
};
</script>

<template>
  <Dialog :open="open" @update:open="updateOpen">
    <DialogContent class="max-w-md rounded-xl p-5">
      <DialogTitle>车夫权限</DialogTitle>
      <form class="mt-4 grid gap-4" @submit.prevent="submit">
        <p class="text-sm">{{ record?.nickname || '未设置昵称' }} · {{ record?.userNo }}</p>
        <label class="flex items-center gap-2 text-sm"><input v-model="isDriver" type="checkbox" :disabled="saving || (!isDriver && (record?.status !== 1 || record?.registerChannel === 5))">是否车夫</label>
        <label v-if="isDriver" class="grid gap-2 text-sm">手机号<Input v-model="phone" type="tel" pattern="1[3-9][0-9]{9}" maxlength="11" required :disabled="saving" :readonly="!!record?.phone" /></label>
        <p v-if="isDriver" class="text-xs text-muted-foreground">车夫可创建实时讲解房间。请确认手机号属于该用户。</p>
        <p v-if="error" role="alert" class="text-sm text-destructive">{{ error }}</p>
        <div class="flex justify-end gap-2"><Button type="button" variant="outline" :disabled="saving" @click="open = false">取消</Button><Button type="submit" :disabled="saving || (isDriver && (record?.status !== 1 || record?.registerChannel === 5))">{{ saving ? '保存中…' : '保存' }}</Button></div>
      </form>
    </DialogContent>
  </Dialog>
</template>
