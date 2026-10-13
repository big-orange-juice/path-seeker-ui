<script setup lang="ts">
import { computed, reactive, watch } from 'vue';
import Button from '@/components/shadcn/button/Button.vue';
import Input from '@/components/shadcn/input/Input.vue';
import Select from '@/components/shadcn/select/Select.vue';
import Dialog from '@/components/shadcn/dialog/Dialog.vue';
import DialogContent from '@/components/shadcn/dialog/DialogContent.vue';
import DialogTitle from '@/components/shadcn/dialog/DialogTitle.vue';
import type { RickshawDraft } from '@/types/rickshaw';

const props = defineProps<{ open: boolean; initial: RickshawDraft; destinations: { id: string; name: string }[]; pending: boolean; error: string }>();
const emit = defineEmits<{ 'update:open': [open: boolean]; save: [draft: RickshawDraft]; search: [keyword: string] }>();
const draft = reactive<RickshawDraft>({ museumId: '', vehicleNo: '', driverName: '', remark: '' });
watch(() => props.open, (open) => { if (open) Object.assign(draft, props.initial, { id: props.initial.id }); }, { immediate: true });
const model = computed({ get: () => props.open, set: (open: boolean) => {
  if (props.pending) return;
  if (!open && JSON.stringify(draft) !== JSON.stringify(props.initial) && !window.confirm('关闭并放弃未保存的车辆资料？')) return;
  emit('update:open', open);
} });
const submit = () => { if (!props.pending) emit('save', { ...draft }); };
</script>

<template>
  <Dialog v-model:open="model">
    <DialogContent class="max-w-lg rounded-xl p-5">
      <DialogTitle>{{ draft.id ? '编辑黄包车' : '新增黄包车' }}</DialogTitle>
      <form class="mt-4 grid gap-4" @submit.prevent="submit">
        <label class="grid gap-2 text-sm">归属目的地
          <Select v-model="draft.museumId" :disabled="pending || !!draft.id" searchable @search="$emit('search', $event)">
            <option v-for="item in destinations" :key="item.id" :value="item.id">{{ item.name }}</option>
          </Select>
        </label>
        <label class="grid gap-2 text-sm">车号<Input v-model="draft.vehicleNo" required maxlength="64" :disabled="pending" /></label>
        <label class="grid gap-2 text-sm">车夫<Input v-model="draft.driverName" maxlength="100" :disabled="pending" /></label>
        <label class="grid gap-2 text-sm">备注<Input v-model="draft.remark" maxlength="500" :disabled="pending" /></label>
        <p v-if="error" role="alert" class="text-sm text-destructive">{{ error }}</p>
        <div class="flex justify-end gap-2">
          <Button type="button" variant="outline" :disabled="pending" @click="model = false">取消</Button>
          <Button type="submit" :disabled="pending || !draft.museumId || !draft.vehicleNo.trim()">{{ pending ? '保存中…' : '保存' }}</Button>
        </div>
      </form>
    </DialogContent>
  </Dialog>
</template>
