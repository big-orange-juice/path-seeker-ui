<script setup lang="ts">
import { computed, reactive, watch } from 'vue';
import Button from '@/components/shadcn/button/Button.vue';
import Dialog from '@/components/shadcn/dialog/Dialog.vue';
import DialogContent from '@/components/shadcn/dialog/DialogContent.vue';
import DialogDescription from '@/components/shadcn/dialog/DialogDescription.vue';
import DialogHeader from '@/components/shadcn/dialog/DialogHeader.vue';
import DialogTitle from '@/components/shadcn/dialog/DialogTitle.vue';
import Input from '@/components/shadcn/input/Input.vue';
import Textarea from '@/components/shadcn/textarea/Textarea.vue';
import type { MuseumFloorDraft } from '@/types/museum';
import type { UploadAttachment } from '@/types/upload';

interface Props {
  open: boolean;
  mode: 'create' | 'edit';
  initialValue: MuseumFloorDraft;
  submitting?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  submitting: false,
});

const emit = defineEmits<{
  'update:open': [value: boolean];
  save: [value: MuseumFloorDraft];
}>();

const formState = reactive<MuseumFloorDraft>({
  floorNumber: '',
  floorName: '',
  floorLevel: 0,
  description: '',
  mapImages: [],
  mapImageFileId: null,
  sortOrder: 0,
});

const dialogTitle = computed(() => (props.mode === 'create' ? '新增楼层' : '编辑楼层'));
const dialogDescription = computed(() => '维护楼层编号、层级、底图与排序。');

const mapImageList = computed({
  get: () => [...formState.mapImages],
  set: (value: string[]) => {
    formState.mapImages = [...value];
    if (!value.length) {
      formState.mapImageFileId = null;
    }
  },
});

const syncFormState = (value: MuseumFloorDraft) => {
  formState.id = value.id;
  formState.floorNumber = value.floorNumber;
  formState.floorName = value.floorName;
  formState.floorLevel = value.floorLevel;
  formState.description = value.description;
  formState.mapImages = [...value.mapImages];
  formState.mapImageFileId = value.mapImageFileId;
  formState.sortOrder = value.sortOrder;
};

watch(
  () => props.initialValue,
  (value) => {
    syncFormState(value);
  },
  { immediate: true, deep: true }
);

const handleMapUploaded = (files: UploadAttachment[]) => {
  const latestFile = files[files.length - 1];
  if (!latestFile) {
    return;
  }

  formState.mapImages = latestFile.fileUrl ? [latestFile.fileUrl] : [];
  formState.mapImageFileId = latestFile.fileId ?? null;
};

const handleOpenChange = (...args: unknown[]) => {
  if (props.submitting) {
    return;
  }

  emit('update:open', Boolean(args[0]));
};

const submitForm = () => {
  if (props.submitting) {
    return;
  }

  emit('save', {
    id: formState.id,
    floorNumber: formState.floorNumber,
    floorName: formState.floorName,
    floorLevel: formState.floorLevel,
    description: formState.description,
    mapImages: [...formState.mapImages],
    mapImageFileId: formState.mapImageFileId,
    sortOrder: formState.sortOrder,
  });
};
</script>

<template>
  <Dialog :open="props.open" @update:open="handleOpenChange">
    <DialogContent class="max-w-[760px] overflow-hidden p-0">
      <div class="border-b border-border/70 px-5 py-3">
        <DialogHeader class="space-y-0.5">
          <DialogTitle class="text-[1.05rem] font-semibold tracking-tight text-foreground">
            {{ dialogTitle }}
          </DialogTitle>
          <DialogDescription class="text-xs text-muted-foreground">
            {{ dialogDescription }}
          </DialogDescription>
        </DialogHeader>
      </div>

      <form class="space-y-4 px-5 py-4" @submit.prevent="submitForm">
        <section class="grid gap-3 md:grid-cols-2">
          <div class="space-y-2">
            <label class="text-sm font-medium text-foreground">楼层号</label>
            <Input v-model="formState.floorNumber" placeholder="例如：3F" />
          </div>
          <div class="space-y-2">
            <label class="text-sm font-medium text-foreground">楼层名称</label>
            <Input v-model="formState.floorName" placeholder="例如：特展走廊" />
          </div>
        </section>

        <section class="grid gap-3 md:grid-cols-2">
          <div class="space-y-2">
            <label class="text-sm font-medium text-foreground">层级</label>
            <Input
              :model-value="String(formState.floorLevel)"
              type="number"
              @update:model-value="formState.floorLevel = Number($event || 0)" />
          </div>
          <div class="space-y-2">
            <label class="text-sm font-medium text-foreground">排序号</label>
            <Input
              :model-value="String(formState.sortOrder)"
              type="number"
              @update:model-value="formState.sortOrder = Number($event || 0)" />
          </div>
        </section>

        <section class="space-y-2">
          <label class="text-sm font-medium text-foreground">楼层说明</label>
          <Textarea
            v-model="formState.description"
            rows="3"
            placeholder="请输入楼层说明" />
        </section>

        <UiImageUpload
          v-model="mapImageList"
          label="楼层底图"
          hint="上传当前楼层对应的底图。"
          button-text="上传底图"
          button-subtext="支持单张"
          :multiple="false"
          @uploaded="handleMapUploaded" />

        <div class="flex justify-end gap-2 border-t border-border/70 pt-3">
          <Button variant="ghost" type="button" @click="emit('update:open', false)">取消</Button>
          <Button type="submit" :disabled="props.submitting">
            {{ props.submitting ? '保存中...' : '保存楼层' }}
          </Button>
        </div>
      </form>
    </DialogContent>
  </Dialog>
</template>
