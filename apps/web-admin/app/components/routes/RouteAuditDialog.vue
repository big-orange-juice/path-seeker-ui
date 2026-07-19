<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import Button from '@/components/shadcn/button/Button.vue';
import Dialog from '@/components/shadcn/dialog/Dialog.vue';
import DialogContent from '@/components/shadcn/dialog/DialogContent.vue';
import DialogDescription from '@/components/shadcn/dialog/DialogDescription.vue';
import DialogFooter from '@/components/shadcn/dialog/DialogFooter.vue';
import DialogHeader from '@/components/shadcn/dialog/DialogHeader.vue';
import DialogTitle from '@/components/shadcn/dialog/DialogTitle.vue';
import type { RouteRecord } from '@/types/route';

const props = defineProps<{
  open: boolean;
  record: RouteRecord | null;
  submitting?: boolean;
}>();

const emit = defineEmits<{
  'update:open': [value: boolean];
  confirm: [payload: { pass: boolean; remark: string }];
}>();

const pass = ref(true);
const remark = ref('');
const localError = ref('');

const isOpen = computed({
  get: () => props.open,
  set: (value: boolean) => emit('update:open', value),
});

const routeName = computed(
  () => props.record?.title || props.record?.routeCode || props.record?.id || '当前路线',
);

const resetForm = () => {
  pass.value = true;
  remark.value = '';
  localError.value = '';
};

watch(
  () => props.open,
  (open) => {
    if (open) {
      resetForm();
      return;
    }
    // 关闭时销毁表单，避免下次审核带上一次备注
    resetForm();
  },
);

const handleConfirm = () => {
  localError.value = '';
  const text = remark.value.trim();
  if (!pass.value && !text) {
    localError.value = '驳回时请填写备注说明。';
    return;
  }
  emit('confirm', { pass: pass.value, remark: text });
};
</script>

<template>
  <Dialog v-model:open="isOpen">
    <DialogContent class="max-w-[min(92vw,26rem)] rounded-xl border border-border bg-[#15171b] p-0 text-left">
      <DialogHeader class="space-y-2 px-5 pb-2 pt-4">
        <DialogTitle>审核路线</DialogTitle>
        <DialogDescription>
          审核「{{ routeName }}」。通过后导游可上架；驳回需填写原因。
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-3 px-5 py-2">
        <div class="flex gap-2">
          <Button
            type="button"
            size="sm"
            class="h-8 flex-1"
            :variant="pass ? 'default' : 'outline'"
            @click="pass = true">
            通过
          </Button>
          <Button
            type="button"
            size="sm"
            class="h-8 flex-1"
            :variant="!pass ? 'default' : 'outline'"
            @click="pass = false">
            驳回
          </Button>
        </div>

        <div class="space-y-1.5">
          <label class="text-sm font-medium text-foreground">
            备注{{ pass ? '（可选）' : '（必填）' }}
          </label>
          <textarea
            v-model="remark"
            rows="3"
            class="w-full resize-none rounded-lg border border-border/70 bg-background/60 px-3 py-2 text-sm text-foreground outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
            :placeholder="pass ? '可填写通过说明' : '请说明驳回原因，便于导游修改'" />
        </div>

        <p v-if="localError" class="text-xs text-destructive">
          {{ localError }}
        </p>
      </div>

      <DialogFooter class="px-5 pb-4 pt-3">
        <Button variant="outline" type="button" :disabled="submitting" @click="isOpen = false">
          取消
        </Button>
        <Button type="button" :disabled="submitting || !record" @click="handleConfirm">
          {{ submitting ? '提交中…' : '确认' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
