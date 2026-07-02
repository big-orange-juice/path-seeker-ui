<script setup lang="ts">
import { computed, reactive, watch } from 'vue';
import type { UploadAttachment } from '@/types/upload';
import type { ExhibitDraft } from '@/types/museum';
import Button from '@/components/shadcn/button/Button.vue';
import Dialog from '@/components/shadcn/dialog/Dialog.vue';
import DialogContent from '@/components/shadcn/dialog/DialogContent.vue';
import DialogDescription from '@/components/shadcn/dialog/DialogDescription.vue';
import DialogHeader from '@/components/shadcn/dialog/DialogHeader.vue';
import DialogTitle from '@/components/shadcn/dialog/DialogTitle.vue';
import Input from '@/components/shadcn/input/Input.vue';
import Select from '@/components/shadcn/select/Select.vue';
import Textarea from '@/components/shadcn/textarea/Textarea.vue';

interface Props {
  open: boolean;
  mode: 'create' | 'edit';
  initialValue: ExhibitDraft;
  submitting?: boolean;
  galleryOptions: Array<{ label: string; value: string }>;
}

const props = withDefaults(defineProps<Props>(), {
  submitting: false,
  galleryOptions: () => [],
});

const emit = defineEmits<{
  'update:open': [value: boolean];
  save: [value: ExhibitDraft];
}>();

const formState = reactive<ExhibitDraft>({
  museumId: '',
  galleryId: null,
  exhibitCode: '',
  name: '',
  dynasty: '',
  material: '',
  category: '',
  description: '',
  imageUrl: null,
  imageFileId: null,
  isHighlight: 0,
  showcaseNo: '',
  recommendedMinutes: null,
  sortOrder: 0,
  extraList: [],
  mediaList: [],
});

const dialogTitle = computed(() => (props.mode === 'create' ? '新增馆藏' : '编辑馆藏'));
const dialogDescription = computed(() => '维护馆藏基础信息、展陈归属与推荐状态。');

const imageList = computed({
  get: () => (formState.imageUrl ? [formState.imageUrl] : []),
  set: (value: string[]) => {
    formState.imageUrl = value[0] ?? null;
    if (!value.length) {
      formState.imageFileId = null;
    }
  },
});

const syncFormState = (value: ExhibitDraft) => {
  formState.id = value.id;
  formState.museumId = value.museumId;
  formState.galleryId = value.galleryId;
  formState.exhibitCode = value.exhibitCode;
  formState.name = value.name;
  formState.dynasty = value.dynasty;
  formState.material = value.material;
  formState.category = value.category;
  formState.description = value.description;
  formState.imageUrl = value.imageUrl;
  formState.imageFileId = value.imageFileId;
  formState.isHighlight = value.isHighlight;
  formState.showcaseNo = value.showcaseNo;
  formState.recommendedMinutes = value.recommendedMinutes;
  formState.sortOrder = value.sortOrder;
  formState.extraList = value.extraList.map((item) => ({ ...item }));
  formState.mediaList = value.mediaList.map((item) => ({ ...item }));
};

watch(
  () => props.initialValue,
  (value) => {
    syncFormState(value);
  },
  { immediate: true, deep: true }
);

const handleOpenChange = (...args: unknown[]) => {
  const value = Boolean(args[0]);
  if (props.submitting) {
    return;
  }

  emit('update:open', value);
};

const closeDialog = () => {
  if (props.submitting) {
    return;
  }

  emit('update:open', false);
};

const handleUpload = (files: UploadAttachment[]) => {
  const firstFile = files[0];
  if (!firstFile) {
    return;
  }

  formState.imageUrl = firstFile.fileUrl;
  formState.imageFileId = firstFile.fileId;
};

const updateNumber = (field: 'recommendedMinutes' | 'sortOrder', value: string) => {
  if (field === 'sortOrder') {
    formState.sortOrder = value === '' ? 0 : Number(value);
    return;
  }

  formState.recommendedMinutes = value === '' ? null : Number(value);
};

const submitForm = () => {
  if (props.submitting) {
    return;
  }

  emit('save', {
    ...formState,
    extraList: formState.extraList.map((item) => ({ ...item })),
    mediaList: formState.mediaList.map((item) => ({ ...item })),
  });
};
</script>

<template>
  <Dialog :open="props.open" @update:open="handleOpenChange">
    <DialogContent class="max-h-[90vh] overflow-hidden p-0">
      <div class="flex items-center justify-between border-b border-border/70 px-5 py-3">
        <DialogHeader class="space-y-0.5">
          <DialogTitle class="text-[1.2rem] font-semibold tracking-tight text-foreground">
            {{ dialogTitle }}
          </DialogTitle>
          <DialogDescription class="text-xs text-muted-foreground">
            {{ dialogDescription }}
          </DialogDescription>
        </DialogHeader>

        <Button variant="ghost" size="icon" :disabled="props.submitting" @click="closeDialog">
          <UiAppIcon name="x" class="h-4 w-4" />
        </Button>
      </div>

      <form class="max-h-[calc(90vh-61px)] space-y-4 overflow-y-auto px-5 py-4" @submit.prevent="submitForm">
        <section class="grid gap-3 md:grid-cols-2">
          <div class="space-y-2">
            <label class="text-sm font-medium text-foreground">馆藏编码</label>
            <Input v-model="formState.exhibitCode" placeholder="如 EXH-BR-001" />
          </div>
          <div class="space-y-2">
            <label class="text-sm font-medium text-foreground">馆藏名称</label>
            <Input v-model="formState.name" placeholder="请输入馆藏名称" />
          </div>
        </section>

        <section class="grid gap-3 md:grid-cols-2">
          <div class="space-y-2">
            <label class="text-sm font-medium text-foreground">所属展馆</label>
            <Select :model-value="formState.galleryId ?? ''" @update:model-value="formState.galleryId = $event || null">
              <option value="">未分配展馆</option>
              <option v-for="option in props.galleryOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </Select>
          </div>
          <div class="space-y-2">
            <label class="text-sm font-medium text-foreground">类别</label>
            <Input v-model="formState.category" placeholder="如 青铜器 / 书画 / 陶瓷" />
          </div>
        </section>

        <section class="grid gap-3 md:grid-cols-2">
          <div class="space-y-2">
            <label class="text-sm font-medium text-foreground">年代/朝代</label>
            <Input v-model="formState.dynasty" placeholder="如 商晚期 / 北宋" />
          </div>
          <div class="space-y-2">
            <label class="text-sm font-medium text-foreground">材质</label>
            <Input v-model="formState.material" placeholder="如 青铜 / 陶 / 纸本" />
          </div>
        </section>

        <section class="grid gap-3 md:grid-cols-3">
          <div class="space-y-2">
            <label class="text-sm font-medium text-foreground">展柜号</label>
            <Input v-model="formState.showcaseNo" placeholder="如 A-12" />
          </div>
          <div class="space-y-2">
            <label class="text-sm font-medium text-foreground">推荐停留时长</label>
            <Input
              :model-value="formState.recommendedMinutes === null ? '' : String(formState.recommendedMinutes)"
              type="number"
              step="1"
              placeholder="分钟"
              @update:model-value="updateNumber('recommendedMinutes', $event)" />
          </div>
          <div class="space-y-2">
            <label class="text-sm font-medium text-foreground">排序号</label>
            <Input
              :model-value="String(formState.sortOrder)"
              type="number"
              step="1"
              placeholder="如 10"
              @update:model-value="updateNumber('sortOrder', $event)" />
          </div>
        </section>

        <section class="grid gap-3 md:grid-cols-2">
          <div class="space-y-2">
            <label class="text-sm font-medium text-foreground">重点展品</label>
            <Select :model-value="String(formState.isHighlight)" @update:model-value="formState.isHighlight = Number($event)">
              <option value="0">普通馆藏</option>
              <option value="1">重点展品</option>
            </Select>
          </div>
          <div class="rounded-xl border border-border/70 bg-secondary/25 px-4 py-3 text-xs leading-5 text-muted-foreground">
            用于维护馆藏基础资料、展馆归属和推荐状态。
          </div>
        </section>

        <section class="space-y-2">
          <label class="text-sm font-medium text-foreground">馆藏描述</label>
          <Textarea
            v-model="formState.description"
            rows="5"
            placeholder="输入馆藏背景、工艺特征或讲解摘要" />
        </section>

        <UiImageUpload
          v-model="imageList"
          label="馆藏主图"
          hint="上传馆藏主图，用于列表预览与后续详情页展示。"
          button-text="上传主图"
          button-subtext="支持 JPG / PNG"
          :multiple="false"
          @uploaded="handleUpload" />

        <div class="flex flex-wrap justify-end gap-2 border-t border-border/70 pt-3">
          <Button variant="ghost" :disabled="props.submitting" @click="syncFormState(props.initialValue)">
            重置
          </Button>
          <Button type="submit" :disabled="props.submitting">
            {{ props.submitting ? '保存中...' : props.mode === 'create' ? '创建馆藏' : '保存修改' }}
          </Button>
        </div>
      </form>
    </DialogContent>
  </Dialog>
</template>

