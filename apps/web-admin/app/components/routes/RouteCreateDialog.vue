<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import Button from '@/components/shadcn/button/Button.vue';
import Dialog from '@/components/shadcn/dialog/Dialog.vue';
import DialogContent from '@/components/shadcn/dialog/DialogContent.vue';
import DialogDescription from '@/components/shadcn/dialog/DialogDescription.vue';
import DialogFooter from '@/components/shadcn/dialog/DialogFooter.vue';
import DialogHeader from '@/components/shadcn/dialog/DialogHeader.vue';
import DialogTitle from '@/components/shadcn/dialog/DialogTitle.vue';
import Input from '@/components/shadcn/input/Input.vue';
import Select from '@/components/shadcn/select/Select.vue';
import Textarea from '@/components/shadcn/textarea/Textarea.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import type { BuildRouteFromThemePayload } from '@/types/route';

interface MuseumOption {
  value: string;
  label: string;
}

interface Props {
  open: boolean;
  museumOptions: MuseumOption[];
  defaultMuseumId?: string;
  submitting?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  defaultMuseumId: '',
  submitting: false,
});

const emit = defineEmits<{
  'update:open': [value: boolean];
  submitAi: [payload: BuildRouteFromThemePayload];
}>();

const activeTab = ref<'ai' | 'manual'>('ai');
const formState = reactive({
  title: '',
  theme: '',
  museumId: '',
  themeQuery: '',
  maxNodes: 35,
  pickCount: 7,
  difficulty: 2,
});
const localError = ref('');

const isOpen = computed({
  get: () => props.open,
  set: (value: boolean) => emit('update:open', value),
});

const canSubmit = computed(() =>
  Boolean(
    formState.title.trim()
    && formState.theme.trim()
    && formState.themeQuery.trim()
    && formState.museumId.trim()
  )
);

const maxNodesModel = computed({
  get: () => String(formState.maxNodes),
  set: (value: string) => {
    formState.maxNodes = Number(value) || 35;
  },
});

const pickCountModel = computed({
  get: () => String(formState.pickCount),
  set: (value: string) => {
    formState.pickCount = Number(value) || 7;
  },
});

const resetForm = () => {
  formState.title = '';
  formState.theme = '';
  formState.museumId = props.defaultMuseumId || props.museumOptions[0]?.value || '';
  formState.themeQuery = '';
  formState.maxNodes = 35;
  formState.pickCount = 7;
  formState.difficulty = 2;
  activeTab.value = 'ai';
  localError.value = '';
};

watch(
  () => props.open,
  (open) => {
    if (open) {
      resetForm();
    }
  }
);

watch(
  () => [props.defaultMuseumId, props.museumOptions] as const,
  () => {
    if (!props.open || formState.museumId) {
      return;
    }

    formState.museumId = props.defaultMuseumId || props.museumOptions[0]?.value || '';
  }
);

const clampInteger = (value: number, min: number, max: number) => Math.min(Math.max(Math.trunc(value), min), max);

const submitAi = () => {
  localError.value = '';

  if (!canSubmit.value) {
    localError.value = '请补全路线标题、主题、提示词和所属博物馆。';
    return;
  }

  emit('submitAi', {
    routeType: 59,
    routeId: '',
    title: formState.title.trim(),
    theme: formState.theme.trim(),
    museumId: formState.museumId.trim(),
    ageGroup: 0,
    themeQuery: formState.themeQuery.trim(),
    maxNodes: clampInteger(formState.maxNodes, 35, 50),
    pickCount: clampInteger(formState.pickCount, 5, 9),
    difficulty: clampInteger(formState.difficulty, 1, 3),
  });
};
</script>

<template>
  <Dialog v-model:open="isOpen">
    <DialogContent class="flex h-[90vh] max-w-[760px] flex-col overflow-hidden">
      <DialogHeader class="border-b border-border/70 px-5 py-4">
        <DialogTitle>新增主题路线</DialogTitle>
        <DialogDescription>选择创建方式并填写路线基础信息。</DialogDescription>
      </DialogHeader>

      <div class="flex border-b border-border/70 px-5 pt-4">
        <button
          type="button"
          class="inline-flex h-9 items-center gap-2 border-b-2 px-4 text-sm font-medium transition-colors"
          :class="activeTab === 'ai' ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'"
          @click="activeTab = 'ai'">
          <AppIcon name="bot" class="h-4 w-4" />
          AI 生成
        </button>
        <button
          type="button"
          class="inline-flex h-9 items-center gap-2 border-b-2 px-4 text-sm font-medium transition-colors"
          :class="activeTab === 'manual' ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'"
          @click="activeTab = 'manual'">
          <AppIcon name="route" class="h-4 w-4" />
          手动创建
        </button>
      </div>

      <form v-if="activeTab === 'ai'" class="flex min-h-0 flex-1 flex-col" @submit.prevent="submitAi">
        <div class="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div v-if="localError" class="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {{ localError }}
          </div>

          <div class="grid gap-4 md:grid-cols-2">
            <div class="space-y-2">
              <label class="text-sm font-medium text-foreground">路线标题</label>
              <Input v-model="formState.title" placeholder="请输入路线标题" />
            </div>
            <div class="space-y-2">
              <label class="text-sm font-medium text-foreground">所属博物馆</label>
              <Select v-model="formState.museumId" :disabled="!props.museumOptions.length">
                <option v-for="option in props.museumOptions" :key="option.value" :value="option.value">
                  {{ option.label }}
                </option>
              </Select>
            </div>
          </div>

          <div class="space-y-2">
            <label class="text-sm font-medium text-foreground">路线主题</label>
            <Input v-model="formState.theme" placeholder="请输入主题方向" />
          </div>

          <div class="space-y-2">
            <label class="text-sm font-medium text-foreground">生成提示</label>
            <Textarea v-model="formState.themeQuery" class="min-h-[104px]" placeholder="请输入生成范围、题材或检索方向" />
          </div>

          <div class="grid gap-4 md:grid-cols-3">
            <div class="space-y-2">
              <label class="text-sm font-medium text-foreground">最大查询数</label>
              <Input v-model="maxNodesModel" type="number" min="35" max="50" />
            </div>
            <div class="space-y-2">
              <label class="text-sm font-medium text-foreground">谜题数量</label>
              <Input v-model="pickCountModel" type="number" min="5" max="9" />
            </div>
            <div class="space-y-2">
              <label class="text-sm font-medium text-foreground">难度</label>
              <Select :model-value="String(formState.difficulty)" @update:model-value="formState.difficulty = Number($event)">
                <option value="1">简单</option>
                <option value="2">普通</option>
                <option value="3">困难</option>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter class="border-t border-border/70 px-5 py-4">
          <Button variant="outline" type="button" :disabled="props.submitting" @click="isOpen = false">
            取消
          </Button>
          <Button type="submit" :disabled="props.submitting || !canSubmit">
            {{ props.submitting ? '生成中...' : '开始生成' }}
          </Button>
        </DialogFooter>
      </form>

      <div v-else class="flex min-h-0 flex-1 flex-col">
        <div class="flex flex-1 items-center justify-center px-5 py-4 text-sm text-muted-foreground">
          手动创建能力稍后开放。
        </div>
        <DialogFooter class="border-t border-border/70 px-5 py-4">
          <Button variant="outline" type="button" @click="isOpen = false">
            关闭
          </Button>
        </DialogFooter>
      </div>
    </DialogContent>
  </Dialog>
</template>
