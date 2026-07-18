<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import AppIcon from '@/components/ui/AppIcon.vue';

interface Props {
  disabled?: boolean;
  sending?: boolean;
  placeholder?: string;
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  sending: false,
  placeholder: '描述你想创建的主题路线…',
});

const emit = defineEmits<{
  send: [message: string];
  cancel: [];
}>();

const draft = ref('');
const textareaRef = ref<HTMLTextAreaElement | null>(null);

const canSubmit = computed(() =>
  Boolean(draft.value.trim()) && !props.disabled && !props.sending,
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
  draft.value = '';
  void resizeTextarea();
  emit('send', message);
};

const onKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    submit();
  }
};
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
        @keydown="onKeydown" />

      <div class="chat-composer__actions">
        <p class="chat-composer__hint">
          <span class="hidden sm:inline">Enter 发送 · Shift+Enter 换行</span>
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
