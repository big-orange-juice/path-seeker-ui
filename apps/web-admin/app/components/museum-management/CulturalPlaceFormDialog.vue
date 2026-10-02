<script setup lang="ts">
import { reactive, shallowRef, watch } from 'vue';
import Button from '@/components/shadcn/button/Button.vue';
import Dialog from '@/components/shadcn/dialog/Dialog.vue';
import DialogContent from '@/components/shadcn/dialog/DialogContent.vue';
import DialogHeader from '@/components/shadcn/dialog/DialogHeader.vue';
import DialogTitle from '@/components/shadcn/dialog/DialogTitle.vue';
import Input from '@/components/shadcn/input/Input.vue';
import Select from '@/components/shadcn/select/Select.vue';
import Textarea from '@/components/shadcn/textarea/Textarea.vue';
import ImageUpload from '@/components/ui/ImageUpload.vue';
import type { CulturalPlaceDraft, CulturalPlaceRecord } from '@/types/cultural-place';
import type { UploadAttachment } from '@/types/upload';

const props = withDefaults(defineProps<{ open: boolean; museumId: string; record: CulturalPlaceRecord | null; pending: boolean; error: string; requireCoordinates?: boolean }>(), { requireCoordinates: true });
const emit = defineEmits<{ 'update:open': [value: boolean]; save: [draft: CulturalPlaceDraft] }>();
const draft = reactive<CulturalPlaceDraft>({ museumId: '', code: '', name: '', category: '', address: '', description: '', recommendedMinutes: 10, longitude: null, latitude: null, coordinateSystem: 1, status: 1, coverAttachmentId: null, sortOrder: 0 });
const cover = shallowRef<string[]>([]);
const validationError = shallowRef('');

watch(() => props.open, open => {
  if (!open) return;
  validationError.value = '';
  const record = props.record;
  Object.assign(draft, { id: record?.id, museumId: props.museumId, code: record?.code || '', name: record?.name || '', category: record?.category || '', address: record?.address || '', description: record?.description || '', recommendedMinutes: record ? record.recommendedMinutes : 10, longitude: record?.longitude ?? null, latitude: record?.latitude ?? null, coordinateSystem: record?.coordinateSystem ?? 1, status: record?.status ?? 1, coverAttachmentId: record?.coverAttachmentId ?? null, sortOrder: record?.sortOrder ?? 0 });
  cover.value = record?.coverUrl ? [record.coverUrl] : [];
});

function uploaded(files: UploadAttachment[]) {
  if (files[0]?.fileUrl) { draft.coverAttachmentId = files[0].fileId; cover.value = [files[0].fileUrl]; }
}

function submit() {
  if (props.pending) return;
  validationError.value = '';
  if ((draft.longitude == null) !== (draft.latitude == null)) {
    validationError.value = '经度与纬度必须同时填写或同时留空。';
    return;
  }
  emit('save', { ...draft, code: draft.code.trim(), name: draft.name.trim(), coverAttachmentId: cover.value.length ? draft.coverAttachmentId : null });
}
</script>

<template>
  <Dialog :open="open" @update:open="!pending && emit('update:open', Boolean($event))">
    <DialogContent class="max-h-[90vh] max-w-2xl overflow-auto">
      <DialogHeader><DialogTitle>{{ record ? '编辑文化点' : '新增文化点' }}</DialogTitle></DialogHeader>
      <form class="space-y-4" @submit.prevent="submit">
        <div class="grid grid-cols-2 gap-3">
          <label class="space-y-1 text-sm">名称<Input v-model="draft.name" required maxlength="200" :disabled="pending" /></label>
          <label class="space-y-1 text-sm">编码<Input v-model="draft.code" required maxlength="64" :disabled="pending" /></label>
          <label class="space-y-1 text-sm">分类<Input :model-value="draft.category || ''" maxlength="64" :disabled="pending" @update:model-value="draft.category = $event" /></label>
          <label class="space-y-1 text-sm">建议停留（分钟）<Input :model-value="String(draft.recommendedMinutes ?? '')" type="number" min="0" :disabled="pending" @update:model-value="draft.recommendedMinutes = $event ? Number($event) : null" /></label>
          <label class="space-y-1 text-sm">经度<Input :model-value="String(draft.longitude ?? '')" type="number" step="any" min="-180" max="180" :required="requireCoordinates" :disabled="pending" @update:model-value="draft.longitude = $event ? Number($event) : null" /></label>
          <label class="space-y-1 text-sm">纬度<Input :model-value="String(draft.latitude ?? '')" type="number" step="any" min="-90" max="90" :required="requireCoordinates" :disabled="pending" @update:model-value="draft.latitude = $event ? Number($event) : null" /></label>
          <label class="space-y-1 text-sm">坐标系<Select :model-value="String(draft.coordinateSystem)" :disabled="pending" @update:model-value="draft.coordinateSystem = Number($event)"><option value="1">WGS84</option><option value="2">GCJ-02</option><option value="3">BD-09</option></Select></label>
          <label class="space-y-1 text-sm">排序<Input :model-value="String(draft.sortOrder)" type="number" :disabled="pending" @update:model-value="draft.sortOrder = Number($event)" /></label>
        </div>
        <label class="block space-y-1 text-sm">地址<Input :model-value="draft.address || ''" maxlength="500" :disabled="pending" @update:model-value="draft.address = $event" /></label>
        <label class="block space-y-1 text-sm">简介<Textarea :model-value="draft.description || ''" rows="4" :disabled="pending" @update:model-value="draft.description = $event" /></label>
        <fieldset class="space-y-1 text-sm" :disabled="pending">封面<ImageUpload v-model="cover" :multiple="false" @uploaded="uploaded" /></fieldset>
        <label v-if="record" class="block space-y-1 text-sm">状态<Select :model-value="String(draft.status)" :disabled="pending" @update:model-value="draft.status = Number($event)"><option value="1">启用</option><option value="2">停用</option></Select></label>
        <p v-if="validationError || error" class="text-sm text-destructive" role="alert">{{ validationError || error }}</p>
        <div class="flex justify-end gap-2"><Button type="button" variant="outline" :disabled="pending" @click="emit('update:open', false)">取消</Button><Button type="submit" :disabled="pending">{{ pending ? '保存中…' : '保存' }}</Button></div>
      </form>
    </DialogContent>
  </Dialog>
</template>
