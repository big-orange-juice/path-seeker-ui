<script setup lang="ts">
import { computed, reactive, shallowRef, watch } from 'vue';
import { v4 as uuidv4 } from 'uuid';
import MapPhonePreview from '@/components/map-management/MapPhonePreview.vue';
import MapVenueListEditor from '@/components/map-management/MapVenueListEditor.vue';
import Dialog from '@/components/shadcn/dialog/Dialog.vue';
import DialogContent from '@/components/shadcn/dialog/DialogContent.vue';
import DialogDescription from '@/components/shadcn/dialog/DialogDescription.vue';
import DialogFooter from '@/components/shadcn/dialog/DialogFooter.vue';
import DialogHeader from '@/components/shadcn/dialog/DialogHeader.vue';
import DialogTitle from '@/components/shadcn/dialog/DialogTitle.vue';
import UiImageUpload from '@/components/ui/ImageUpload.vue';
import type { FloorMapDraft, VenueDraft } from '@/types/map-management';
import type { UploadAttachment } from '@/types/upload';

interface Props {
  open: boolean;
  mode: 'create' | 'edit';
  initialValue: FloorMapDraft;
  submitting?: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  'update:open': [value: boolean];
  save: [value: FloorMapDraft];
}>();

const formState = reactive<FloorMapDraft>({
  floorNumber: '',
  floorName: '',
  floorLevel: 0,
  description: '',
  mapImages: [],
  mapImageFileId: null,
  sortOrder: 0,
  venues: []
});

const activeVenueId = shallowRef('');
const pickingVenueId = shallowRef('');
const draftPoint = shallowRef<{ x: number; y: number } | null>(null);

const dialogTitle = computed(() =>
  props.mode === 'create' ? '新增楼层地图' : '编辑楼层地图'
);
const dialogDescription = computed(
  () => '维护楼层基础信息、地图底图和展馆点位。'
);

const syncFormState = (value: FloorMapDraft) => {
  formState.id = value.id;
  formState.floorNumber = value.floorNumber;
  formState.floorName = value.floorName;
  formState.floorLevel = value.floorLevel;
  formState.description = value.description;
  formState.mapImages = [...value.mapImages];
  formState.mapImageFileId = value.mapImageFileId;
  formState.sortOrder = value.sortOrder;
  formState.venues = value.venues.map((venue) => ({ ...venue }));
};

watch(
  () => props.initialValue,
  (value) => {
    syncFormState(value);
  },
  { immediate: true, deep: true }
);

watch(
  () => formState.venues,
  (venues) => {
    if (!venues.length) {
      activeVenueId.value = '';
      pickingVenueId.value = '';
      draftPoint.value = null;
      return;
    }

    if (!venues.some((venue) => venue.id === activeVenueId.value)) {
      activeVenueId.value = venues[0]?.id ?? '';
    }

    if (
      pickingVenueId.value &&
      !venues.some((venue) => venue.id === pickingVenueId.value)
    ) {
      pickingVenueId.value = '';
      draftPoint.value = null;
    }
  },
  { immediate: true, deep: true }
);

const handleOpenChange = (...args: unknown[]) => {
  if (props.submitting) {
    return;
  }

  emit('update:open', Boolean(args[0]));
};

const closeDialog = () => {
  if (props.submitting) {
    return;
  }

  emit('update:open', false);
};

const updateVenue = ({
  targetId,
  patch
}: {
  targetId: string;
  patch: Partial<VenueDraft>;
}) => {
  formState.venues = formState.venues.map((venue) =>
    venue.id === targetId ? { ...venue, ...patch } : venue
  );
};

const addVenue = () => {
  const nextVenue: VenueDraft = {
    id: uuidv4(),
    galleryCode: '',
    name: '',
    subtitle: '',
    category: 1,
    description: '',
    exhibitCount: null,
    area: null,
    coverImageUrl: null,
    coverImageFileId: null,
    openStatus: 1,
    x: null,
    y: null,
    sortOrder: formState.venues.length + 1
  };

  formState.venues = [...formState.venues, nextVenue];
  activeVenueId.value = nextVenue.id;
};

const removeVenue = (targetId: string) => {
  formState.venues = formState.venues
    .filter((venue) => venue.id !== targetId)
    .map((venue, index) => ({ ...venue, sortOrder: index + 1 }));
  if (activeVenueId.value === targetId) {
    activeVenueId.value =
      formState.venues.find((venue) => venue.id !== targetId)?.id ?? '';
  }
  if (pickingVenueId.value === targetId) {
    pickingVenueId.value = '';
    draftPoint.value = null;
  }
};

const selectVenue = (targetId: string) => {
  activeVenueId.value = targetId;
};

const beginPick = (targetId: string) => {
  activeVenueId.value = targetId;
  pickingVenueId.value = targetId;
  draftPoint.value = null;
};

const capturePoint = (payload: { x: number; y: number }) => {
  if (!pickingVenueId.value) {
    return;
  }

  draftPoint.value = payload;
};

const cancelPick = () => {
  pickingVenueId.value = '';
  draftPoint.value = null;
};

const confirmPick = () => {
  if (!pickingVenueId.value || !draftPoint.value) {
    return;
  }

  updateVenue({ targetId: pickingVenueId.value, patch: draftPoint.value });
  activeVenueId.value = pickingVenueId.value;
  pickingVenueId.value = '';
  draftPoint.value = null;
};

const handleMapUploaded = (files: UploadAttachment[]) => {
  const latestFile = files[files.length - 1];
  if (!latestFile) {
    return;
  }

  formState.mapImages = latestFile.fileUrl ? [latestFile.fileUrl] : [];
  formState.mapImageFileId = latestFile.fileId ?? null;
};

const submitForm = () => {
  if (props.submitting) {
    return;
  }

  emit('save', {
    id: formState.id,
    floorNumber: formState.floorNumber,
    floorName: formState.floorName,
    floorLevel: formState.floorLevel,
    description: formState.description,
    mapImages: [...formState.mapImages],
    mapImageFileId: formState.mapImageFileId,
    sortOrder: formState.sortOrder,
    venues: formState.venues.map((venue, index) => ({
      ...venue,
      sortOrder: venue.sortOrder || index + 1
    }))
  });
};
</script>

<template>
  <Dialog :open="props.open" @update:open="handleOpenChange">
    <DialogContent class="h-[90vh] overflow-hidden p-0">
      <div class="flex h-full flex-col">
        <div class="flex items-center justify-between border-b border-border/70 px-5 py-3">
          <DialogHeader class="space-y-0.5">
            <DialogTitle class="text-[1.2rem] font-semibold tracking-tight text-foreground">
              {{ dialogTitle }}
            </DialogTitle>
            <DialogDescription class="text-xs text-muted-foreground">
              {{ dialogDescription }}
            </DialogDescription>
          </DialogHeader>

          <UiButton variant="ghost" size="icon" :disabled="props.submitting" @click="closeDialog">
            <UiAppIcon name="x" class="h-4 w-4" />
          </UiButton>
        </div>

        <form class="flex min-h-0 flex-1 flex-col" @submit.prevent="submitForm">
          <div class="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            <div class="grid gap-3 xl:grid-cols-[420px_500px_minmax(320px,1fr)] xl:items-start">
              <section class="space-y-4 rounded-[0.95rem] bg-[#0f1114] p-4">
                <div class="space-y-1">
                  <h3 class="text-sm font-semibold text-foreground">基础信息</h3>
                  <p class="text-xs text-muted-foreground">维护楼层编号、名称、排序和底图。</p>
                </div>

                <div class="grid gap-3 md:grid-cols-2">
                  <div class="space-y-2">
                    <label class="text-sm font-medium text-foreground">楼层号</label>
                    <UiInput v-model="formState.floorNumber" placeholder="例如：3F" />
                  </div>

                  <div class="space-y-2">
                    <label class="text-sm font-medium text-foreground">楼层名称</label>
                    <UiInput v-model="formState.floorName" placeholder="例如：特展走廊" />
                  </div>

                  <div class="space-y-2">
                    <label class="text-sm font-medium text-foreground">楼层层级</label>
                    <UiInput
                      :model-value="String(formState.floorLevel)"
                      type="number"
                      placeholder="例如：3"
                      @update:model-value="formState.floorLevel = Number($event || 0)" />
                  </div>

                  <div class="space-y-2">
                    <label class="text-sm font-medium text-foreground">排序号</label>
                    <UiInput
                      :model-value="String(formState.sortOrder)"
                      type="number"
                      placeholder="例如：10"
                      @update:model-value="formState.sortOrder = Number($event || 0)" />
                  </div>
                </div>

                <div class="space-y-2">
                  <label class="text-sm font-medium text-foreground">楼层描述</label>
                  <UiTextarea
                    v-model="formState.description"
                    rows="4"
                    placeholder="例如：连接中庭与东展区的主通道" />
                </div>

                <UiImageUpload
                  v-model="formState.mapImages"
                  :multiple="false"
                  label="地图上传"
                  hint="上传后用于楼层卡片和取点预览。"
                  button-text="上传地图"
                  item-label="地图"
                  @uploaded="handleMapUploaded" />
              </section>

              <MapVenueListEditor
                :venues="formState.venues"
                :active-venue-id="activeVenueId"
                :picking-venue-id="pickingVenueId"
                :draft-point="draftPoint"
                @add-venue="addVenue"
                @remove-venue="removeVenue"
                @select-venue="selectVenue"
                @update-venue="updateVenue"
                @begin-pick="beginPick"
                @confirm-pick="confirmPick"
                @cancel-pick="cancelPick" />

              <MapPhonePreview
                :venues="formState.venues"
                :active-venue-id="activeVenueId"
                :picking-venue-id="pickingVenueId"
                :draft-point="draftPoint"
                :map-image="formState.mapImages[0]"
                @select-venue="selectVenue"
                @capture-point="capturePoint" />
            </div>
          </div>

          <DialogFooter class="sticky bottom-0 flex items-center justify-end gap-3 border-t border-border/70 bg-[#111316] px-7 py-4">
            <UiButton type="button" variant="ghost" :disabled="props.submitting" @click="closeDialog">
              取消
            </UiButton>
            <UiButton type="submit" :disabled="props.submitting">
              {{ props.submitting ? '保存中...' : '保存地图' }}
            </UiButton>
          </DialogFooter>
        </form>
      </div>
    </DialogContent>
  </Dialog>
</template>



