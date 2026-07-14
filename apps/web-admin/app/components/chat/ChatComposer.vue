<script setup lang="ts">
import { computed, ref } from 'vue';
import Button from '@/components/shadcn/button/Button.vue';
import Textarea from '@/components/shadcn/textarea/Textarea.vue';
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

const canSubmit = computed(() =>
  Boolean(draft.value.trim()) && !props.disabled && !props.sending,
);

const submit = () => {
  if (!canSubmit.value) {
    return;
  }

  const message = draft.value.trim();
  draft.value = '';
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
  <div class="space-y-2 border-t border-border/70 px-4 py-3">
    <Textarea
      v-model="draft"
      class="min-h-[84px] resize-none"
      :placeholder="props.placeholder"
      :disabled="props.disabled || props.sending"
      @keydown="onKeydown" />
    <div class="flex items-center justify-between gap-2">
      <p class="text-xs text-muted-foreground">
        Enter 发送，Shift + Enter 换行
      </p>
      <div class="flex items-center gap-2">
        <Button
          v-if="props.sending"
          variant="outline"
          size="sm"
          type="button"
          @click="emit('cancel')">
          取消
        </Button>
        <Button size="sm" type="button" :disabled="!canSubmit" @click="submit">
          <AppIcon
            :name="props.sending ? 'loader-circle' : 'send'"
            class="h-3.5 w-3.5"
            :class="props.sending ? 'animate-spin' : ''" />
          {{ props.sending ? '发送中' : '发送' }}
        </Button>
      </div>
    </div>
  </div>
</template>
