<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, useTemplateRef, watch } from 'vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import type { ChatAttachmentReference, ChatComposerSubmitPayload } from '@/types/chat';

const MAX_IMAGE_COUNT = 4;
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const MAX_TOTAL_IMAGE_SIZE = 25 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

interface PendingImage {
  id: string;
  file: File;
  previewUrl: string;
}

interface Props {
  disabled?: boolean;
  sending?: boolean;
  placeholder?: string;
  referencedAttachments?: ChatAttachmentReference[];
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  sending: false,
  placeholder: '描述你想创建的主题路线…',
  referencedAttachments: () => [],
});

const emit = defineEmits<{
  send: [payload: ChatComposerSubmitPayload];
  cancel: [];
  removeReference: [attachmentId: string];
}>();

const draft = ref('');
const pendingImages = ref<PendingImage[]>([]);
const pasteError = shallowRef('');
const textareaRef = useTemplateRef<HTMLTextAreaElement>('textareaRef');
const referenceAttachmentIds = computed(() =>
  Array.from(new Set(
    props.referencedAttachments
      .map((item) => String(item.attachmentId).trim())
      .filter(Boolean),
  )).slice(0, MAX_IMAGE_COUNT),
);

const canSubmit = computed(() =>
  (
    Boolean(draft.value.trim())
    || pendingImages.value.length > 0
    || referenceAttachmentIds.value.length > 0
  )
  && !props.disabled
  && !props.sending,
);

const resizeTextarea = async () => {
  await nextTick();
  const el = textareaRef.value;
  if (!el) {
    return;
  }

  el.style.height = 'auto';
  el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
};

watch(draft, () => {
  void resizeTextarea();
});

const submit = () => {
  if (!canSubmit.value) {
    return;
  }

  const message = draft.value.trim();
  const images = pendingImages.value.map((item) => item.file);
  const attachmentIds = [...referenceAttachmentIds.value];
  draft.value = '';
  clearPendingImages();
  void resizeTextarea();
  emit('send', { message, images, attachmentIds });
};

const clearPendingImages = () => {
  for (const image of pendingImages.value) {
    URL.revokeObjectURL(image.previewUrl);
  }

  pendingImages.value = [];
  pasteError.value = '';
};

const removePendingImage = (id: string) => {
  const target = pendingImages.value.find((item) => item.id === id);
  if (target) {
    URL.revokeObjectURL(target.previewUrl);
  }

  pendingImages.value = pendingImages.value.filter((item) => item.id !== id);
  pasteError.value = '';
};

const addPastedImages = (files: File[]) => {
  pasteError.value = '';

  const acceptedFiles = files.filter((file) => ACCEPTED_IMAGE_TYPES.has(file.type));
  if (acceptedFiles.length !== files.length) {
    pasteError.value = '仅支持 JPEG、PNG 或 WebP 图片。';
  }

  const availableCount = MAX_IMAGE_COUNT
    - referenceAttachmentIds.value.length
    - pendingImages.value.length;
  const candidates = acceptedFiles.slice(0, Math.max(availableCount, 0));
  if (acceptedFiles.length > availableCount) {
    pasteError.value = `每条消息最多粘贴 ${MAX_IMAGE_COUNT} 张图片。`;
  }

  let totalSize = pendingImages.value.reduce((total, item) => total + item.file.size, 0);
  const nextImages: PendingImage[] = [];

  for (const file of candidates) {
    if (file.size > MAX_IMAGE_SIZE) {
      pasteError.value = '单张图片不能超过 10 MB。';
      continue;
    }

    if (totalSize + file.size > MAX_TOTAL_IMAGE_SIZE) {
      pasteError.value = '本条消息的图片总大小不能超过 25 MB。';
      continue;
    }

    totalSize += file.size;
    nextImages.push({
      id: crypto.randomUUID(),
      file,
      previewUrl: URL.createObjectURL(file),
    });
  }

  pendingImages.value = [...pendingImages.value, ...nextImages];
};

const onPaste = (event: ClipboardEvent) => {
  const imageFiles = Array.from(event.clipboardData?.items ?? [])
    .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
    .map((item) => item.getAsFile())
    .filter((file): file is File => Boolean(file));

  if (imageFiles.length) {
    event.preventDefault();
    addPastedImages(imageFiles);
  }
};

const onKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    submit();
  }
};

onBeforeUnmount(clearPendingImages);
</script>

<template>
  <div class="chat-composer">
    <div
      class="chat-composer__dock"
      :class="{
        'is-disabled': props.disabled,
        'is-sending': props.sending,
      }">
      <textarea
        ref="textareaRef"
        v-model="draft"
        rows="1"
        class="chat-composer__input"
        :placeholder="props.placeholder"
        :disabled="props.disabled || props.sending"
        @keydown="onKeydown"
        @paste="onPaste" />

      <div v-if="pendingImages.length" class="chat-composer__images">
        <div
          v-for="image in pendingImages"
          :key="image.id"
          class="chat-composer__image-wrap">
          <img
            :src="image.previewUrl"
            :alt="image.file.name || '待发送图片'"
            class="chat-composer__image">
          <button
            type="button"
            class="chat-composer__image-remove"
            :disabled="props.sending"
            title="移除图片"
            @click="removePendingImage(image.id)">
            <AppIcon name="x" class="h-3 w-3" />
          </button>
        </div>
      </div>

      <div v-if="props.referencedAttachments.length" class="chat-composer__references">
        <div
          v-for="reference in props.referencedAttachments"
          :key="reference.attachmentId"
          class="chat-composer__reference">
          <img
            :src="reference.imageUrl"
            :alt="reference.label"
            class="chat-composer__reference-image">
          <span class="chat-composer__reference-label">{{ reference.label }}</span>
          <button
            type="button"
            class="chat-composer__reference-remove"
            :disabled="props.sending"
            title="移除引用"
            @click="emit('removeReference', reference.attachmentId)">
            <AppIcon name="x" class="h-3 w-3" />
          </button>
        </div>
      </div>

      <p v-if="pasteError" class="chat-composer__error">{{ pasteError }}</p>

      <div class="chat-composer__actions">
        <p class="chat-composer__hint">
          <span class="hidden sm:inline">可粘贴图片 · Enter 发送 · Shift+Enter 换行</span>
          <span class="sm:hidden">Enter 发送</span>
        </p>

        <button
          v-if="props.sending"
          type="button"
          class="chat-composer__ghost"
          @click="emit('cancel')">
          停止
        </button>

        <button
          type="button"
          class="chat-composer__send"
          :disabled="!canSubmit"
          :title="props.sending ? '发送中' : '发送'"
          @click="submit">
          <AppIcon
            :name="props.sending ? 'loader-circle' : 'send'"
            class="h-3.5 w-3.5"
            :class="props.sending ? 'animate-spin' : ''" />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.chat-composer {
  position: relative;
  padding: 0.65rem 0.75rem 0.8rem;
}

.chat-composer::before {
  content: '';
  position: absolute;
  inset: 0 0.75rem auto;
  height: 1px;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(209, 178, 111, 0.22),
    transparent
  );
}

.chat-composer__dock {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  border-radius: 0.95rem;
  border: 1px solid rgba(209, 178, 111, 0.18);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.03), transparent 48%),
    rgba(14, 15, 18, 0.92);
  padding: 0.55rem 0.6rem 0.5rem;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.04),
    0 10px 28px rgba(0, 0, 0, 0.18);
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease;
}

.chat-composer__dock:focus-within {
  border-color: rgba(209, 178, 111, 0.42);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.05),
    0 0 0 3px rgba(209, 178, 111, 0.1),
    0 12px 30px rgba(0, 0, 0, 0.2);
}

.chat-composer__dock.is-disabled {
  opacity: 0.62;
}

.chat-composer__dock.is-sending {
  border-color: rgba(209, 178, 111, 0.28);
}

.chat-composer__input {
  width: 100%;
  min-height: 2.4rem;
  max-height: 8.75rem;
  resize: none;
  border: 0;
  background: transparent;
  padding: 0.2rem 0.25rem;
  color: hsl(var(--foreground));
  font-size: 0.875rem;
  line-height: 1.55;
  outline: none;
}

.chat-composer__input::placeholder {
  color: rgba(168, 170, 176, 0.72);
}

.chat-composer__input:disabled {
  cursor: not-allowed;
}

.chat-composer__images {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.chat-composer__references {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.chat-composer__reference {
  display: inline-flex;
  min-width: 0;
  max-width: 11rem;
  align-items: center;
  gap: 0.35rem;
  border-radius: 0.55rem;
  border: 1px solid rgba(209, 178, 111, 0.2);
  background: rgba(209, 178, 111, 0.06);
  padding: 0.2rem 0.3rem 0.2rem 0.2rem;
}

.chat-composer__reference-image {
  height: 1.75rem;
  width: 1.75rem;
  flex-shrink: 0;
  border-radius: 0.35rem;
  object-fit: cover;
}

.chat-composer__reference-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11px;
  color: hsl(var(--foreground));
}

.chat-composer__reference-remove {
  display: inline-flex;
  height: 1.25rem;
  width: 1.25rem;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  color: hsl(var(--muted-foreground));
}

.chat-composer__reference-remove:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.06);
  color: hsl(var(--foreground));
}

.chat-composer__image-wrap {
  position: relative;
  height: 3.25rem;
  width: 3.25rem;
}

.chat-composer__image {
  height: 100%;
  width: 100%;
  border-radius: 0.55rem;
  border: 1px solid rgba(209, 178, 111, 0.2);
  object-fit: cover;
}

.chat-composer__image-remove {
  position: absolute;
  top: -0.3rem;
  right: -0.3rem;
  display: inline-flex;
  height: 1.1rem;
  width: 1.1rem;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(15, 16, 19, 0.96);
  color: hsl(var(--muted-foreground));
}

.chat-composer__image-remove:hover:not(:disabled) {
  color: hsl(var(--foreground));
}

.chat-composer__error {
  font-size: 11px;
  color: hsl(var(--destructive));
}

.chat-composer__actions {
  display: flex;
  align-items: center;
  gap: 0.45rem;
}

.chat-composer__hint {
  margin-right: auto;
  font-size: 10px;
  letter-spacing: 0.04em;
  color: rgba(168, 170, 176, 0.72);
}

.chat-composer__ghost {
  height: 1.75rem;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.03);
  padding: 0 0.65rem;
  font-size: 11px;
  color: hsl(var(--muted-foreground));
  transition: color 0.15s ease, border-color 0.15s ease, background 0.15s ease;
}

.chat-composer__ghost:hover {
  border-color: rgba(209, 178, 111, 0.28);
  background: rgba(209, 178, 111, 0.08);
  color: hsl(var(--foreground));
}

.chat-composer__send {
  display: inline-flex;
  height: 2rem;
  width: 2rem;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  border: 1px solid rgba(209, 178, 111, 0.35);
  background:
    linear-gradient(145deg, rgba(232, 205, 138, 0.95), rgba(186, 150, 78, 0.95));
  color: #1a160d;
  box-shadow: 0 8px 16px rgba(209, 178, 111, 0.18);
  transition:
    transform 0.15s ease,
    opacity 0.15s ease,
    box-shadow 0.15s ease;
}

.chat-composer__send:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 10px 18px rgba(209, 178, 111, 0.24);
}

.chat-composer__send:disabled {
  cursor: not-allowed;
  opacity: 0.42;
  box-shadow: none;
}
</style>
