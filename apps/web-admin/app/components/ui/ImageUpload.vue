<script setup lang="ts">
import { computed, shallowRef, useTemplateRef } from 'vue';
import { useUploadAttachment } from '@/composables/useUploadAttachment';
import type { UploadAttachment, UploadTarget } from '@/types/upload';

interface Props {
  label?: string;
  hint?: string;
  buttonText?: string;
  buttonSubtext?: string;
  itemLabel?: string;
  primaryHint?: string;
  secondaryHint?: string;
  setPrimaryText?: string;
  removeText?: string;
  accept?: string;
  multiple?: boolean;
  uploadTarget?: UploadTarget;
}

const props = withDefaults(defineProps<Props>(), {
  label: '图片上传',
  hint: '上传后可在列表中预览和调整顺序。',
  buttonText: '上传图片',
  buttonSubtext: '支持多图',
  itemLabel: '图片',
  primaryHint: '当前主图',
  secondaryHint: '可设为主图',
  setPrimaryText: '设主图',
  removeText: '删除',
  accept: undefined,
  multiple: true,
  uploadTarget: 'image',
});

const model = defineModel<string[]>({ default: () => [] });
const emit = defineEmits<{
  uploaded: [files: UploadAttachment[]];
}>();

const fileInputRef = useTemplateRef<HTMLInputElement>('fileInput');
const previews = computed(() => model.value);
const resolvedAccept = computed(() =>
  props.accept ?? (props.uploadTarget === 'image' ? 'image/*' : '*/*')
);
const isUploading = shallowRef(false);
const uploadError = shallowRef('');
const { uploadAttachment } = useUploadAttachment();

const openPicker = () => {
  if (isUploading.value) {
    return;
  }

  fileInputRef.value?.click();
};

const getItemTitle = (url: string, index: number) => {
  if (props.uploadTarget === 'image') {
    return `${props.itemLabel} ${index + 1}`;
  }

  const sanitizedUrl = url.split('?')[0] ?? url;
  const segments = sanitizedUrl.split('/');
  const fileName = segments[segments.length - 1];
  return fileName ? decodeURIComponent(fileName) : `${props.itemLabel} ${index + 1}`;
};

const handleFiles = async (event: Event) => {
  const input = event.target as HTMLInputElement;
  const files = Array.from(input.files ?? []);
  if (!files.length) {
    return;
  }

  isUploading.value = true;
  uploadError.value = '';

  try {
    const uploadedFiles = await Promise.all(
      files.map((file) => uploadAttachment(file, props.uploadTarget))
    );
    const nextUrls = uploadedFiles
      .map((file) => file.fileUrl)
      .filter((fileUrl): fileUrl is string => Boolean(fileUrl));

    model.value = props.multiple ? [...model.value, ...nextUrls] : nextUrls.slice(0, 1);
    emit('uploaded', uploadedFiles);
  } catch (error) {
    uploadError.value =
      error instanceof Error ? error.message : '上传失败，请稍后重试。';
  } finally {
    isUploading.value = false;
    input.value = '';
  }
};

const setPrimaryImage = (index: number) => {
  if (!index) {
    return;
  }

  const nextImages = [...model.value];
  const [selectedImage] = nextImages.splice(index, 1);
  if (!selectedImage) {
    return;
  }

  model.value = [selectedImage, ...nextImages];
};

const removeImage = (index: number) => {
  model.value = model.value.filter((_, currentIndex) => currentIndex !== index);
};
</script>

<template>
  <div class="space-y-2.5">
    <div class="space-y-1">
      <label class="text-sm font-medium">{{ props.label }}</label>
      <p class="text-xs text-muted-foreground">{{ props.hint }}</p>
    </div>

    <input
      ref="fileInput"
      type="file"
      :accept="resolvedAccept"
      :multiple="props.multiple"
      class="hidden"
      @change="handleFiles">

    <button
      type="button"
      class="flex w-full items-center justify-center gap-3 rounded-xl border border-dashed border-primary/30 bg-secondary/25 px-4 py-4 text-center transition hover:border-primary/50 hover:bg-secondary/40 disabled:cursor-not-allowed disabled:opacity-70"
      :disabled="isUploading"
      @click="openPicker">
      <UiAppIcon name="image-up" class="h-4.5 w-4.5 text-primary" />
      <span class="text-sm font-medium">
        {{ isUploading ? '上传中...' : props.buttonText }}
      </span>
      <span class="text-xs text-muted-foreground">
        {{ isUploading ? '请稍候' : props.buttonSubtext }}
      </span>
    </button>

    <p v-if="uploadError" class="text-xs text-destructive">
      {{ uploadError }}
    </p>

    <div v-if="previews.length" class="space-y-2">
      <div
        v-for="(image, index) in previews"
        :key="`${index}-${image.slice(0, 24)}`"
        class="flex items-center gap-3 rounded-xl bg-[#0d0f12] p-2.5 ring-1 ring-white/5">
        <img
          v-if="props.uploadTarget === 'image'"
          :src="image"
          :alt="`${props.itemLabel}缩略图 ${index + 1}`"
          class="h-11 w-11 rounded-lg object-cover">
        <div
          v-else
          class="flex h-11 w-11 items-center justify-center rounded-lg bg-secondary/40 text-muted-foreground">
          <UiAppIcon name="image-up" class="h-4 w-4" />
        </div>
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-medium text-foreground">
            {{ getItemTitle(image, index) }}
          </p>
          <p class="text-[11px] text-muted-foreground">
            {{ index === 0 ? props.primaryHint : props.secondaryHint }}
          </p>
        </div>
        <div class="flex items-center gap-2">
          <UiButton
            v-if="props.multiple && index !== 0"
            variant="secondary"
            size="sm"
            :disabled="isUploading"
            @click="setPrimaryImage(index)">
            {{ props.setPrimaryText }}
          </UiButton>
          <UiButton
            variant="ghost"
            size="sm"
            :disabled="isUploading"
            @click="removeImage(index)">
            {{ props.removeText }}
          </UiButton>
        </div>
      </div>
    </div>
  </div>
</template>
