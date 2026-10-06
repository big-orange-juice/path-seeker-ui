<script setup lang="ts">
import { computed } from 'vue';
import Dialog from '@/components/shadcn/dialog/Dialog.vue';
import DialogContent from '@/components/shadcn/dialog/DialogContent.vue';
import DialogDescription from '@/components/shadcn/dialog/DialogDescription.vue';
import DialogFooter from '@/components/shadcn/dialog/DialogFooter.vue';
import DialogHeader from '@/components/shadcn/dialog/DialogHeader.vue';
import DialogTitle from '@/components/shadcn/dialog/DialogTitle.vue';
import Button from '@/components/ui/Button.vue';
import type { PlatformAssistantConfirmResponse } from '@/types/platform-assistant';
import { formatAssistantTime } from '@/utils/platform-assistant';

/**
 * 平台助手写入类工具「逐次确认」弹窗。
 *
 * 后端 PlatformAssistantWriteGuard：模型调用写入类工具时，若没有与"工具名 + 参数哈希"
 * 匹配的一次性许可，会下发 SSE 事件 confirmation.required（payload 为
 * `{ toolName, confirmationToken, argumentsHash, expiresAt, message }`）而不执行；
 * 管理员在本弹窗确认后调用 POST /api/PlatformAssistant/confirm 换取一次性许可（用后即焚），
 * 再由模型用完全相同的参数重试该工具。
 *
 * 默认白名单只含只读工具，这条路径默认不会激活；写入类工具被加入白名单后才会走到这里。
 */
interface Props {
  open: boolean;
  toolName: string;
  message: string;
  /** 后端下发的参数哈希（后端不下发具体参数） */
  argumentsHash: string;
  /** 许可有效期（ISO 字符串） */
  expiresAt: string;
  confirming: boolean;
  error: string;
  confirmed: PlatformAssistantConfirmResponse | null;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  'update:open': [value: boolean];
  confirm: [];
  continue: [];
}>();

const expiresAtLabel = computed(() => formatAssistantTime(props.expiresAt));
const hashPreview = computed(() =>
  (props.argumentsHash ? `${props.argumentsHash.slice(0, 16)}${props.argumentsHash.length > 16 ? '…' : ''}` : '（未下发）'));

const confirmedToolName = computed(() => props.confirmed?.toolName || props.toolName);
const confirmedExpiresAtLabel = computed(() => formatAssistantTime(props.confirmed?.expiresAt));

/**
 * Dialog 的 update:open 在 vue-tsc 下推断为 (...args: unknown[]) => any，
 * 因此这里显式收窄参数为 unknown 再转 boolean，避免类型不兼容。
 */
const handleOpenChange = (value: unknown) => {
  emit('update:open', Boolean(value));
};
</script>

<template>
  <Dialog :open="props.open" @update:open="handleOpenChange">
    <DialogContent class="max-w-[min(92vw,30rem)] rounded-xl border border-border bg-[#15171b] p-0 text-left">
      <DialogHeader class="border-b border-white/5 px-5 py-4">
        <DialogTitle class="text-sm font-medium text-foreground">
          {{ props.confirmed ? '写入许可已确认' : '写操作需要逐次确认' }}
        </DialogTitle>
        <DialogDescription class="mt-1 text-xs leading-5 text-muted-foreground">
          {{ props.confirmed
            ? '一次性许可已下发，需要重发上一条指令让助手用完全相同的参数重试该工具。'
            : '本次模型调用了写入类工具。后端默认只下发只读工具，写入操作必须由你逐次确认后才会执行一次。' }}
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-3 px-5 py-4 text-xs leading-5">
        <div>
          <p class="text-[11px] uppercase tracking-wide text-muted-foreground">工具</p>
          <code class="mt-1 block break-all text-[12px] text-amber-200">{{ confirmedToolName || '未知工具' }}</code>
        </div>

        <p v-if="!props.confirmed" class="rounded-md border border-amber-400/25 bg-amber-400/10 p-2 text-amber-100">
          {{ props.message || '该操作会修改平台数据，需要管理员确认后才执行。' }}
        </p>

        <div v-if="!props.confirmed">
          <p class="text-[11px] uppercase tracking-wide text-muted-foreground">参数哈希</p>
          <p class="mt-1 break-all text-[11px] text-muted-foreground">
            {{ hashPreview }} —— 后端只下发参数哈希、不下发具体参数；许可与"工具名 + 参数哈希"绑定，
            参数一旦变化需要重新确认。
          </p>
        </div>

        <p v-if="!props.confirmed && expiresAtLabel" class="text-[11px] text-muted-foreground">
          确认令牌有效期至 {{ expiresAtLabel }}。
        </p>

        <p v-if="props.confirmed" class="rounded-md border border-emerald-400/25 bg-emerald-400/10 p-2 text-emerald-100">
          {{ props.confirmed.message }}
        </p>

        <p v-if="props.confirmed" class="text-[11px] text-muted-foreground">
          工具：{{ confirmedToolName }}
          <span v-if="confirmedExpiresAtLabel"> · 许可有效期至 {{ confirmedExpiresAtLabel }}</span>
        </p>

        <p v-if="props.error" class="rounded-md border border-red-400/25 bg-red-400/10 p-2 text-red-200">
          {{ props.error }}
        </p>
      </div>

      <DialogFooter class="border-t border-white/5 px-5 py-4">
        <template v-if="props.confirmed">
          <Button variant="ghost" size="sm" @click="handleOpenChange(false)">关闭</Button>
          <Button variant="default" size="sm" @click="emit('continue')">继续执行</Button>
        </template>
        <template v-else>
          <Button variant="ghost" size="sm" :disabled="props.confirming" @click="handleOpenChange(false)">
            取消
          </Button>
          <Button variant="default" size="sm" :disabled="props.confirming" @click="emit('confirm')">
            {{ props.confirming ? '确认中…' : '确认执行一次' }}
          </Button>
        </template>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
