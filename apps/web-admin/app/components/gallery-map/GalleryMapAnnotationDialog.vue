<script setup lang="ts">
import { computed, reactive, shallowRef, watch } from 'vue';
import Dialog from '@/components/shadcn/dialog/Dialog.vue';
import DialogContent from '@/components/shadcn/dialog/DialogContent.vue';
import DialogDescription from '@/components/shadcn/dialog/DialogDescription.vue';
import DialogFooter from '@/components/shadcn/dialog/DialogFooter.vue';
import DialogHeader from '@/components/shadcn/dialog/DialogHeader.vue';
import DialogTitle from '@/components/shadcn/dialog/DialogTitle.vue';
import Button from '@/components/shadcn/button/Button.vue';
import Input from '@/components/shadcn/input/Input.vue';
import Textarea from '@/components/shadcn/textarea/Textarea.vue';
import GalleryMapExhibitPicker from '@/components/gallery-map/GalleryMapExhibitPicker.vue';
import type {
  CreateGalleryMapAnnotationRequest,
  GalleryMapAnnotationRequest,
  GalleryMapCoordinate,
  GalleryMapExhibitSelection,
  GalleryMapPointExhibitItemRequest,
  GalleryMapPointRecord,
  UpdateGalleryMapAnnotationRequest,
} from '@/types/gallery-map';

interface Props {
  open: boolean;
  mode?: 'create' | 'edit';
  mapId: string;
  museumId: string;
  coordinate: GalleryMapCoordinate | null;
  point?: GalleryMapPointRecord | null;
  pointCount?: number;
  submitting?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  mode: 'create',
  point: null,
  pointCount: 0,
  submitting: false,
});

const emit = defineEmits<{
  'update:open': [value: boolean];
  save: [payload: GalleryMapAnnotationRequest];
}>();

const formState = reactive({
  title: '',
  description: '',
  sourcePayload: null as string | null,
  sortOrder: 1,
  exhibits: [] as GalleryMapExhibitSelection[],
});
const titleTouched = shallowRef(false);
const sourcePointCode = shallowRef('');

const createSourcePointCode = () => {
  const suffix = typeof globalThis.crypto?.randomUUID === 'function'
    ? globalThis.crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);
  const iso = new Date().toISOString();
  const timestamp = (iso.split('.')[0] ?? iso)
    .replaceAll('-', '')
    .replaceAll(':', '')
    .replace('T', '')
    .slice(0, 14);
  return `MANUAL-${timestamp}-${suffix}`.toUpperCase();
};

const toExistingSelection = (
  item: GalleryMapPointRecord['exhibits'][number],
  index: number,
): GalleryMapExhibitSelection => {
  const sourceExhibitCode = item.sourceExhibitCode.trim();
  const relationId = item.id?.trim() || null;
  const id = item.exhibitId || `source:${relationId || sourceExhibitCode || index}`;
  const name = item.exhibitName.trim() || item.sourceExhibitName.trim();

  return {
    id,
    exhibitId: item.exhibitId,
    name,
    exhibitCode: sourceExhibitCode,
    imageUrl: item.sourceImageUrl,
    galleryId: null,
    sourceExhibitName: item.sourceExhibitName.trim() || name,
    sourceDetailUrl: item.sourceDetailUrl,
    sourceImageUrl: item.sourceImageUrl,
    matchStatus: item.matchStatus,
    matchMethod: item.matchMethod || null,
    relationId,
  };
};

const resetForm = () => {
  const point = props.mode === 'edit' ? props.point : null;
  if (point) {
    const exhibits = point.exhibits.map(toExistingSelection);
    formState.title = point.title.trim() || exhibits[0]?.name || '';
    formState.description = point.description;
    formState.sourcePayload = point.sourcePayload;
    formState.sortOrder = Math.max(point.sortOrder, 1);
    formState.exhibits = exhibits;
    titleTouched.value = Boolean(point.title.trim());
    sourcePointCode.value = point.sourcePointCode.trim();
    return;
  }

  formState.title = '';
  formState.description = '';
  formState.sourcePayload = null;
  formState.sortOrder = Math.max(props.pointCount + 1, 1);
  formState.exhibits = [];
  titleTouched.value = false;
  sourcePointCode.value = createSourcePointCode();
};

watch(
  [() => props.open, () => props.mode, () => props.point?.id],
  ([open]) => {
    if (open) {
      resetForm();
    }
  },
  { immediate: true },
);

const handleExhibitsUpdate = (value: GalleryMapExhibitSelection[]) => {
  formState.exhibits = value;
  if (!titleTouched.value) {
    formState.title = value[0]?.name ?? '';
  }
};

const handleTitleInput = (value: string) => {
  titleTouched.value = true;
  formState.title = value;
};

const coordinateLabel = computed(() => {
  const coordinate = resolvedCoordinate.value;
  if (!coordinate) {
    return '未取点';
  }

  return `${coordinate.xPercent.toFixed(4)}%, ${coordinate.yPercent.toFixed(4)}%`;
});

const resolvedCoordinate = computed<GalleryMapCoordinate | null>(() => {
  if (props.mode === 'edit' && props.point) {
    return {
      xPercent: props.point.xPercent,
      yPercent: props.point.yPercent,
    };
  }

  return props.coordinate;
});

const dialogTitle = computed(() => (props.mode === 'edit' ? '编辑文物点位' : '新增文物点位'));
const dialogDescription = computed(() => (
  props.mode === 'edit'
    ? '更新点位信息，并同步完整的关联文物集合。'
    : '选择底图位置，并绑定已有系统文物。'
));

const validationMessage = computed(() => {
  if (!props.mapId) {
    return '请先选择地图。';
  }

  const coordinate = resolvedCoordinate.value;
  if (!coordinate || !Number.isFinite(coordinate.xPercent) || !Number.isFinite(coordinate.yPercent)) {
    return '请先在底图上选择点位。';
  }

  if (props.mode === 'edit' && !props.point) {
    return '当前点位数据不可用。';
  }

  if (!formState.title.trim()) {
    return '请输入点位标题。';
  }

  if (!formState.exhibits.length) {
    return '至少选择一件系统文物。';
  }

  if (formState.exhibits.some((item) => !item.exhibitCode.trim() || !item.name.trim())) {
    return '所选文物缺少名称或编码，无法保存。';
  }

  const sourceCodes = formState.exhibits.map((item) => item.exhibitCode.trim());
  if (new Set(sourceCodes).size !== sourceCodes.length) {
    return '关联文物的来源编码不能重复。';
  }

  return '';
});

const handleOpenChange = (open: unknown) => {
  if (props.submitting) {
    return;
  }

  emit('update:open', Boolean(open));
};

const closeDialog = () => {
  if (!props.submitting) {
    emit('update:open', false);
  }
};

const submitForm = () => {
  const coordinate = resolvedCoordinate.value;
  if (props.submitting || validationMessage.value || !coordinate) {
    return;
  }

  const exhibits: GalleryMapPointExhibitItemRequest[] = formState.exhibits.map((item, index) => ({
    exhibitId: item.exhibitId,
    sourceExhibitCode: item.exhibitCode.trim(),
    sourceExhibitName: (item.sourceExhibitName || item.name).trim(),
    sourceDetailUrl: item.sourceDetailUrl ?? null,
    sourceImageUrl: item.sourceImageUrl ?? item.imageUrl,
    matchStatus: typeof item.matchStatus === 'number' && Number.isInteger(item.matchStatus)
      ? item.matchStatus
      : 1,
    matchMethod: item.matchMethod ?? 'manual',
    sortOrder: index + 1,
  }));

  const basePayload = {
    galleryMapId: props.point?.galleryMapId || props.mapId,
    sourcePointCode: sourcePointCode.value,
    markerType: props.point?.markerType || 1,
    xPercent: coordinate.xPercent,
    yPercent: coordinate.yPercent,
    title: formState.title.trim() || null,
    description: formState.description.trim() || null,
    sourcePayload: formState.sourcePayload,
    sortOrder: Number.isInteger(formState.sortOrder) && formState.sortOrder > 0
      ? formState.sortOrder
      : Math.max(props.pointCount + 1, 1),
    exhibits,
  };

  if (props.mode === 'edit' && props.point) {
    const updatePayload: UpdateGalleryMapAnnotationRequest = {
      ...basePayload,
      id: props.point.id,
    };
    emit('save', updatePayload);
    return;
  }

  const createPayload: CreateGalleryMapAnnotationRequest = basePayload;
  emit('save', createPayload);
};
</script>

<template>
  <Dialog :open="props.open" @update:open="handleOpenChange">
    <DialogContent class="h-[90vh] max-w-[min(92vw,760px)] overflow-hidden p-0">
      <div class="flex h-full min-h-0 flex-col">
        <DialogHeader class="shrink-0 border-b border-border/70 px-5 pb-3 pt-4 pr-14">
          <DialogTitle class="text-base font-semibold tracking-tight text-foreground">
            {{ dialogTitle }}
          </DialogTitle>
          <DialogDescription class="text-xs leading-5 text-muted-foreground">
            {{ dialogDescription }}
          </DialogDescription>
        </DialogHeader>

        <form class="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4" @submit.prevent="submitForm">
          <section class="grid gap-3 sm:grid-cols-2">
            <div class="space-y-1.5">
              <label class="text-xs font-medium">点位坐标</label>
              <Input :model-value="coordinateLabel" disabled />
            </div>
            <div class="space-y-1.5">
              <label class="text-xs font-medium">排序号</label>
              <Input
                :model-value="String(formState.sortOrder)"
                type="number"
                min="1"
                step="1"
                @update:model-value="formState.sortOrder = $event === '' ? 1 : Number($event)" />
            </div>
          </section>

          <section v-if="props.mode === 'edit'" class="space-y-1.5">
            <label class="text-xs font-medium">来源点位编码</label>
            <Input :model-value="sourcePointCode" disabled />
          </section>

          <section class="space-y-1.5">
            <label class="text-xs font-medium">点位标题</label>
            <Input
              :model-value="formState.title"
              placeholder="例如：镶嵌十字纹方钺"
              @update:model-value="handleTitleInput" />
          </section>

          <section class="space-y-1.5">
            <label class="text-xs font-medium">点位说明</label>
            <Textarea v-model="formState.description" rows="4" placeholder="补充点位的展陈说明或管理备注" />
          </section>

          <GalleryMapExhibitPicker
            :museum-id="props.museumId"
            :disabled="props.submitting"
            :model-value="formState.exhibits"
            @update:model-value="handleExhibitsUpdate" />

          <p v-if="validationMessage" class="rounded-md border border-amber-500/30 bg-amber-500/8 px-3 py-2 text-xs leading-5 text-amber-200/85">
            {{ validationMessage }}
          </p>
        </form>

        <DialogFooter class="shrink-0 border-t border-border/70 px-5 py-3">
          <Button type="button" variant="ghost" :disabled="props.submitting" @click="closeDialog">
            取消
          </Button>
          <Button type="submit" :disabled="props.submitting || Boolean(validationMessage)" @click="submitForm">
            {{ props.submitting ? '保存中…' : props.mode === 'edit' ? '保存修改' : '保存点位' }}
          </Button>
        </DialogFooter>
      </div>
    </DialogContent>
  </Dialog>
</template>
