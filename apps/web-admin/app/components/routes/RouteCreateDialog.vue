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
import RouteChatWorkspace from '@/components/routes/RouteChatWorkspace.vue';
import type { BuildRouteFromThemePayload } from '@/types/route';

/** 后端仍要求 difficulty，UI 不再暴露，固定中等 */
const DEFAULT_DIFFICULTY = 2;

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
  submitManual: [payload: BuildRouteFromThemePayload];
  routeChanged: [routeId: string];
  routePublished: [routeId: string];
}>();

const activeTab = ref<'ai' | 'manual'>('ai');
const showAdvanced = ref(false);
const formState = reactive({
  title: '',
  theme: '',
  museumId: '',
  themeQuery: '',
  maxNodes: 35,
  pickCount: 7,
});
const localError = ref('');
const chatWorkspaceRef = ref<InstanceType<typeof RouteChatWorkspace> | null>(null);

const isOpen = computed({
  get: () => props.open,
  set: (value: boolean) => emit('update:open', value),
});

const canSubmitManual = computed(() =>
  Boolean(
    formState.title.trim()
    && formState.theme.trim()
    && formState.themeQuery.trim()
    && formState.museumId.trim(),
  ),
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
  activeTab.value = 'ai';
  showAdvanced.value = false;
  localError.value = '';
  chatWorkspaceRef.value?.resetSession();
};

watch(
  () => props.open,
  (open) => {
    if (open) {
      resetForm();
      return;
    }

    // 关闭时中断流式并清空表单/会话，避免下次打开残留上一次内容
    chatWorkspaceRef.value?.abortActiveRun();
    resetForm();
  },
);

watch(
  () => [props.defaultMuseumId, props.museumOptions] as const,
  () => {
    if (!props.open || formState.museumId) {
      return;
    }

    formState.museumId = props.defaultMuseumId || props.museumOptions[0]?.value || '';
  },
);

const clampInteger = (value: number, min: number, max: number) =>
  Math.min(Math.max(Math.trunc(value), min), max);

const submitManual = () => {
  localError.value = '';

  if (!canSubmitManual.value) {
    localError.value = '请补全路线标题、主题、创作要求和所属博物馆。';
    return;
  }

  emit('submitManual', {
    routeType: 59,
    routeId: '',
    title: formState.title.trim(),
    theme: formState.theme.trim(),
    museumId: formState.museumId.trim(),
    ageGroup: 0,
    themeQuery: formState.themeQuery.trim(),
    maxNodes: clampInteger(formState.maxNodes, 35, 50),
    pickCount: clampInteger(formState.pickCount, 5, 9),
    difficulty: DEFAULT_DIFFICULTY,
  });
};
</script>

<template>
  <Dialog v-model:open="isOpen">
    <DialogContent class="flex h-[90vh] max-w-[min(96vw,1280px)] flex-col overflow-hidden p-0">
      <div class="flex h-14 shrink-0 items-center border-b border-border/70 px-5 pr-12">
        <DialogHeader class="min-w-0 space-y-0.5 text-left">
          <DialogTitle class="text-base">
            新增主题路线
          </DialogTitle>
          <DialogDescription class="text-xs">
            一句话主题即可开始；也可按条件生成路线。
          </DialogDescription>
        </DialogHeader>
      </div>

      <div class="flex shrink-0 border-b border-border/70 px-5 pt-3">
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
          按条件生成
        </button>
      </div>

      <div v-show="activeTab === 'ai'" class="flex min-h-0 flex-1 flex-col">
        <RouteChatWorkspace
          ref="chatWorkspaceRef"
          :active="props.open"
          @route-changed="emit('routeChanged', $event)"
          @route-published="emit('routePublished', $event)" />
      </div>

      <div v-show="activeTab === 'manual'" class="flex min-h-0 flex-1 flex-col">
        <div class="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div v-if="localError" class="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {{ localError }}
          </div>

          <div class="grid gap-4 md:grid-cols-2">
            <div class="space-y-2">
              <label class="text-sm font-medium">路线标题</label>
              <Input v-model="formState.title" placeholder="请输入路线标题" />
            </div>
            <div class="space-y-2">
              <label class="text-sm font-medium">所属博物馆</label>
              <Select v-model="formState.museumId" :disabled="!props.museumOptions.length">
                <option v-for="option in props.museumOptions" :key="option.value" :value="option.value">
                  {{ option.label }}
                </option>
              </Select>
            </div>
          </div>

          <div class="space-y-2">
            <label class="text-sm font-medium">路线主题</label>
            <Input v-model="formState.theme" placeholder="一句话概括，如：青铜器里的礼仪与战争" />
            <p class="text-[11px] text-muted-foreground">
              给访客看的主题方向，尽量简短好记。
            </p>
          </div>

          <div class="space-y-2">
            <label class="text-sm font-medium">创作要求</label>
            <Textarea
              v-model="formState.themeQuery"
              class="min-h-[104px]"
              placeholder="补充生成条件，如：侧重二楼青铜厅、适合亲子、避开过于专业的术语" />
            <p class="text-[11px] text-muted-foreground">
              告诉系统怎么挑展品、怎么出题；与上方「主题」不同，不会直接当标题展示。
            </p>
          </div>

          <div class="space-y-2">
            <label class="text-sm font-medium">站点数量</label>
            <Input
              v-model="pickCountModel"
              type="number"
              min="5"
              max="9"
              placeholder="建议 5–9" />
            <p class="text-[11px] text-muted-foreground">
              建议 5–9 个站点，对应路线内探索点数量。
            </p>
          </div>

          <div class="rounded-lg border border-border/60 bg-background/30">
            <button
              type="button"
              class="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm text-muted-foreground transition hover:text-foreground"
              @click="showAdvanced = !showAdvanced">
              <span>高级选项</span>
              <span class="text-xs">{{ showAdvanced ? '收起' : '展开' }}</span>
            </button>
            <div v-if="showAdvanced" class="space-y-2 border-t border-border/50 px-3 py-3">
              <label class="text-sm font-medium">最多参考资料数</label>
              <Input v-model="maxNodesModel" type="number" min="35" max="50" />
              <p class="text-[11px] text-muted-foreground">
                一般无需修改，系统默认即可。
              </p>
            </div>
          </div>
        </div>
      </div>

      <DialogFooter class="h-14 shrink-0 items-center border-t border-border/70 px-5">
        <Button
          variant="outline"
          type="button"
          class="h-8"
          :disabled="props.submitting"
          @click="isOpen = false">
          {{ activeTab === 'manual' ? '取消' : '关闭' }}
        </Button>
        <Button
          v-if="activeTab === 'manual'"
          type="button"
          class="h-8"
          :disabled="props.submitting || !canSubmitManual"
          @click="submitManual">
          {{ props.submitting ? '生成中...' : '开始生成' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
