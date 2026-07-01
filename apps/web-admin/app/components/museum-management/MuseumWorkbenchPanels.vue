<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue';
import MapPhonePreview from '@/components/map-management/MapPhonePreview.vue';
import MapVenueListEditor from '@/components/map-management/MapVenueListEditor.vue';
import MuseumFloorDialog from '@/components/museum-management/MuseumFloorDialog.vue';
import Dialog from '@/components/shadcn/dialog/Dialog.vue';
import DialogContent from '@/components/shadcn/dialog/DialogContent.vue';
import DialogDescription from '@/components/shadcn/dialog/DialogDescription.vue';
import DialogHeader from '@/components/shadcn/dialog/DialogHeader.vue';
import DialogTitle from '@/components/shadcn/dialog/DialogTitle.vue';
import type { VenueDraft } from '@/types/map-management';
import type {
  MuseumFacilityDraft,
  MuseumFacilityRecord,
  MuseumFloorDraft,
  MuseumFloorRecord,
} from '@/types/museum';
import type { UploadAttachment } from '@/types/upload';

interface Props {
  museumId?: string;
  section?: 'floors' | 'galleries' | 'facilities';
  disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  museumId: '',
  section: 'floors',
  disabled: false,
});

const activeSection = computed<'floors' | 'galleries' | 'facilities'>(() => {
  if (props.section === 'galleries' || props.section === 'facilities') {
    return props.section;
  }

  return 'floors';
});

const workbench = useMuseumWorkbench(() => props.museumId, () => activeSection.value);
const floors = workbench.floors;
const facilities = workbench.facilities;
const floorOptions = workbench.floorOptions;
const galleries = workbench.galleries;
const floorMaps = workbench.floorMaps;

const hasMuseumId = computed(() => Boolean(String(props.museumId ?? '').trim()));

const createEmptyVenue = (index: number): VenueDraft => ({
  id: crypto.randomUUID(),
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
  sortOrder: index + 1,
});

const floorDialogOpen = shallowRef(false);
const floorDialogMode = shallowRef<'create' | 'edit'>('create');
const floorSubmitting = shallowRef(false);
const activeFloorId = shallowRef('');
const floorDraft = shallowRef<MuseumFloorDraft>(workbench.createEmptyFloorDraft());

const selectedFloorId = shallowRef('');
const venueDrafts = shallowRef<VenueDraft[]>([]);
const galleryPointSubmitting = shallowRef(false);
const activeVenueId = shallowRef('');
const pickingVenueId = shallowRef('');
const draftPoint = shallowRef<{ x: number; y: number } | null>(null);

const facilityDialogOpen = shallowRef(false);
const facilityDialogMode = shallowRef<'create' | 'edit'>('create');
const facilitySubmitting = shallowRef(false);
const activeFacilityId = shallowRef('');
const facilityDraft = shallowRef<MuseumFacilityDraft>(workbench.createEmptyFacilityDraft());

const facilityTypeOptions = [
  { value: 1, label: '卫生间' },
  { value: 2, label: '饮水处' },
  { value: 3, label: '寄存处' },
  { value: 4, label: '餐饮' },
  { value: 5, label: '商店' },
  { value: 6, label: '电梯' },
  { value: 7, label: '母婴室' },
  { value: 8, label: '医务室' },
  { value: 9, label: '咨询台' },
  { value: 10, label: '无障碍设施' },
  { value: 99, label: '其他' },
];

const facilityIconList = computed({
  get: () => (facilityDraft.value.iconUrl ? [facilityDraft.value.iconUrl] : []),
  set: (value: string[]) => {
    facilityDraft.value.iconUrl = value[0] ?? null;
    if (!value.length) {
      facilityDraft.value.iconFileId = null;
    }
  },
});

const selectedFloor = computed(
  () => floors.value.find((floor) => floor.id === selectedFloorId.value) ?? null
);
const selectedFloorMap = computed(
  () => floorMaps.value.find((floor) => floor.id === selectedFloorId.value) ?? null
);
const selectedFloorMapImage = computed(() => selectedFloorMap.value?.mapImages[0] ?? '');
const selectedFloorVenueCount = computed(() => venueDrafts.value.length);
const galleryEmptyMessage = computed(() => {
  if (!floors.value.length) {
    return '请先新增楼层，再维护当前主体的场馆点位。';
  }

  return '当前楼层还没有场馆点位，可直接新增。';
});

const activeSectionError = computed(() => {
  if (activeSection.value === 'galleries') {
    return workbench.resourceErrors.value.galleries;
  }

  if (activeSection.value === 'facilities') {
    return workbench.resourceErrors.value.facilities;
  }

  return workbench.resourceErrors.value.floors;
});

const activeSectionPending = computed(() => {
  if (activeSection.value === 'galleries') {
    return workbench.resourcePending.value.galleries;
  }

  if (activeSection.value === 'facilities') {
    return workbench.resourcePending.value.facilities;
  }

  return workbench.resourcePending.value.floors;
});

watch(
  floors,
  (floors) => {
    if (!floors.length) {
      selectedFloorId.value = '';
      return;
    }

    if (!floors.some((floor) => floor.id === selectedFloorId.value)) {
      selectedFloorId.value = floors[0]?.id ?? '';
    }
  },
  { immediate: true }
);

watch(
  selectedFloorMap,
  (floorMap) => {
    venueDrafts.value = floorMap?.venues.map((venue) => ({ ...venue })) ?? [];
  },
  { immediate: true }
);

watch(
  venueDrafts,
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

    if (pickingVenueId.value && !venues.some((venue) => venue.id === pickingVenueId.value)) {
      pickingVenueId.value = '';
      draftPoint.value = null;
    }
  },
  { immediate: true, deep: true }
);

const openCreateFloor = () => {
  floorDialogMode.value = 'create';
  activeFloorId.value = '';
  floorDraft.value = workbench.createEmptyFloorDraft();
  floorDialogOpen.value = true;
};

const openEditFloor = (record: MuseumFloorRecord) => {
  floorDialogMode.value = 'edit';
  activeFloorId.value = record.id;
  floorDraft.value = workbench.createFloorDraftFromRecord(record);
  floorDialogOpen.value = true;
};

const saveFloor = async (draft: MuseumFloorDraft) => {
  floorSubmitting.value = true;
  try {
    await workbench.saveFloor(draft, floorDialogMode.value === 'edit' ? activeFloorId.value : undefined);
    floorDialogOpen.value = false;
  } finally {
    floorSubmitting.value = false;
  }
};

const removeFloor = async (record: MuseumFloorRecord) => {
  if (!window.confirm(`确认删除楼层“${record.floorNumber || record.floorName || record.id}”吗？`)) {
    return;
  }

  await workbench.deleteFloor(record.id);
};

const updateVenue = ({
  targetId,
  patch,
}: {
  targetId: string;
  patch: Partial<VenueDraft>;
}) => {
  venueDrafts.value = venueDrafts.value.map((venue) =>
    venue.id === targetId ? { ...venue, ...patch } : venue
  );
};

const addVenue = () => {
  const nextVenue = createEmptyVenue(venueDrafts.value.length);
  venueDrafts.value = [...venueDrafts.value, nextVenue];
  activeVenueId.value = nextVenue.id;
};

const removeVenue = (targetId: string) => {
  venueDrafts.value = venueDrafts.value
    .filter((venue) => venue.id !== targetId)
    .map((venue, index) => ({
      ...venue,
      sortOrder: index + 1,
    }));

  if (activeVenueId.value === targetId) {
    activeVenueId.value = venueDrafts.value[0]?.id ?? '';
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
  const targetVenue = venueDrafts.value.find((venue) => venue.id === targetId) ?? null;
  draftPoint.value =
    targetVenue?.x !== null && targetVenue?.x !== undefined && targetVenue?.y !== null && targetVenue?.y !== undefined
      ? { x: targetVenue.x, y: targetVenue.y }
      : null;
};

const capturePoint = (payload: { x: number; y: number }) => {
  if (!pickingVenueId.value) {
    return;
  }

  draftPoint.value = payload;
};

const updateVenuePoint = (payload: { targetId: string; point: { x: number; y: number } }) => {
  updateVenue({
    targetId: payload.targetId,
    patch: {
      x: payload.point.x,
      y: payload.point.y,
    },
  });
  activeVenueId.value = payload.targetId;
};

const cancelPick = () => {
  pickingVenueId.value = '';
  draftPoint.value = null;
};

const confirmPick = () => {
  if (!pickingVenueId.value || !draftPoint.value) {
    return;
  }

  updateVenue({
    targetId: pickingVenueId.value,
    patch: {
      x: draftPoint.value.x,
      y: draftPoint.value.y,
    },
  });
  activeVenueId.value = pickingVenueId.value;
  pickingVenueId.value = '';
  draftPoint.value = null;
};

const saveCurrentFloorGalleries = async () => {
  if (!selectedFloorId.value) {
    return;
  }

  galleryPointSubmitting.value = true;

  try {
    const existingGalleryIds = new Set(
      galleries.value
        .filter((gallery) => gallery.floorId === selectedFloorId.value)
        .map((gallery) => gallery.id)
    );
 
    const nextGalleryIds = new Set(
      venueDrafts.value.filter((venue) => /^\d+$/.test(venue.id)).map((venue) => venue.id)
    );

    const floorCode = selectedFloor.value?.floorNumber || 'F';

    for (const [index, venue] of venueDrafts.value.entries()) {
      await workbench.saveGallery(
        {
          floorId: selectedFloorId.value,
          galleryCode: venue.galleryCode || `G-${floorCode}-${index + 1}`,
          name: venue.name || `未命名场馆 ${index + 1}`,
          subtitle: venue.subtitle,
          category: venue.category,
          description: venue.description,
          exhibitCount: venue.exhibitCount,
          area: venue.area,
          coverImageUrl: venue.coverImageUrl,
          coverImageFileId: venue.coverImageFileId,
          openStatus: venue.openStatus,
          x: venue.x,
          y: venue.y,
          sortOrder: venue.sortOrder || index + 1,
        },
        /^\d+$/.test(venue.id) ? venue.id : undefined,
        { refresh: false }
      );
    }

    for (const existingId of existingGalleryIds) {
      if (nextGalleryIds.has(existingId)) {
        continue;
      }

      await workbench.deleteGallery(existingId, { refresh: false });
    }

    await workbench.refresh();
  } finally {
    galleryPointSubmitting.value = false;
  }
};

const updateFacilitySortOrder = (value: string) => {
  facilityDraft.value.sortOrder = value === '' ? 0 : Number(value);
};

const handleFacilityUploaded = (files: UploadAttachment[]) => {
  const latestFile = files[files.length - 1];
  facilityDraft.value.iconFileId = latestFile?.fileId ?? null;
};

const openCreateFacility = () => {
  facilityDialogMode.value = 'create';
  activeFacilityId.value = '';
  facilityDraft.value = workbench.createEmptyFacilityDraft();
  facilityDialogOpen.value = true;
};

const openEditFacility = (record: MuseumFacilityRecord) => {
  facilityDialogMode.value = 'edit';
  activeFacilityId.value = record.id;
  facilityDraft.value = workbench.createFacilityDraftFromRecord(record);
  facilityDialogOpen.value = true;
};

const saveFacility = async () => {
  facilitySubmitting.value = true;
  try {
    await workbench.saveFacility(
      facilityDraft.value,
      facilityDialogMode.value === 'edit' ? activeFacilityId.value : undefined
    );
    facilityDialogOpen.value = false;
  } finally {
    facilitySubmitting.value = false;
  }
};

const removeFacility = async (record: MuseumFacilityRecord) => {
  if (!window.confirm(`确认删除设施“${record.name || record.id}”吗？`)) {
    return;
  }

  await workbench.deleteFacility(record.id);
};
</script>

<template>
  <div class="space-y-4">
    <div
      v-if="!hasMuseumId"
      class="rounded-[0.9rem] border border-dashed border-border/70 bg-secondary/20 px-4 py-8 text-center text-sm text-muted-foreground">
      请先创建并保存主体，再继续维护楼层、场馆和设施。
    </div>

    <template v-else>
      <div
        v-if="activeSectionError"
        class="rounded-[0.9rem] border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        {{ activeSectionError }}
      </div>

      <AdminSectionCard
        v-if="activeSection === 'floors'"
        title="楼层地图"
        description="维护当前主体下的楼层编号、层级、底图与排序。">
        <div class="space-y-3">
          <div class="flex justify-end">
            <UiButton size="sm" :disabled="props.disabled || floorSubmitting" @click="openCreateFloor">
              新增楼层
            </UiButton>
          </div>

          <div
            v-if="activeSectionPending"
            class="rounded-md bg-secondary/20 px-4 py-6 text-center text-sm text-muted-foreground">
            正在加载楼层数据...
          </div>

          <div
            v-else-if="!floors.length"
            class="rounded-md bg-secondary/20 px-4 py-6 text-center text-sm text-muted-foreground">
            当前主体还没有楼层。
          </div>

          <div v-else class="grid gap-3 lg:grid-cols-2">
            <article
              v-for="floor in floors"
              :key="floor.id"
              class="grid gap-3 rounded-[0.9rem] border border-border/70 bg-secondary/20 px-4 py-3 md:grid-cols-[minmax(0,1fr)_168px]">
              <div class="space-y-1.5">
                <div class="flex flex-wrap items-center gap-2">
                  <p class="text-sm font-semibold text-foreground">
                    {{ floor.floorNumber || '未命名楼层' }}
                  </p>
                  <span class="text-xs text-muted-foreground">
                    {{ floor.floorName || '未填写楼层名称' }}
                  </span>
                </div>
                <div class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>层级：{{ floor.floorLevel }}</span>
                  <span>排序：{{ floor.sortOrder }}</span>
                  <span>{{ floor.mapImages.length ? '已上传底图' : '未上传底图' }}</span>
                </div>
                <p class="text-xs leading-5 text-muted-foreground">
                  {{ floor.description || '未填写楼层说明。' }}
                </p>
              </div>
              <div class="flex items-end justify-end gap-2">
                <UiButton variant="secondary" size="sm" @click="openEditFloor(floor)">
                  编辑
                </UiButton>
                <UiButton variant="ghost" size="sm" @click="removeFloor(floor)">
                  删除
                </UiButton>
              </div>
            </article>
          </div>
        </div>
      </AdminSectionCard>

      <AdminSectionCard
        v-else-if="activeSection === 'galleries'"
        title="场馆点位"
        description="按楼层维护场馆资料、点位坐标，并同步预览当前楼层底图。">
        <div class="space-y-3">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div class="flex flex-wrap gap-2">
              <button
                v-for="floor in floors"
                :key="floor.id"
                type="button"
                class="rounded-md border px-3 py-1.5 text-sm transition-colors"
                :class="
                  selectedFloorId === floor.id
                    ? 'border-primary/35 bg-primary/10 text-foreground'
                    : 'border-border bg-secondary/30 text-muted-foreground hover:bg-secondary/45 hover:text-foreground'
                "
                @click="selectedFloorId = floor.id">
                {{ floor.floorNumber || floor.floorName || '未命名楼层' }}
              </button>
            </div>

            <div class="flex flex-wrap items-center gap-2">
              <span class="text-xs text-muted-foreground">
                当前楼层 {{ selectedFloorVenueCount }} 个场馆
              </span>
              <UiButton
                size="sm"
                variant="secondary"
                :disabled="props.disabled || !selectedFloorId"
                @click="addVenue">
                新增场馆
              </UiButton>
              <UiButton
                size="sm"
                :disabled="props.disabled || galleryPointSubmitting || !selectedFloorId"
                @click="saveCurrentFloorGalleries">
                {{ galleryPointSubmitting ? '保存中...' : '保存当前楼层' }}
              </UiButton>
            </div>
          </div>

          <div
            v-if="activeSectionPending"
            class="rounded-md bg-secondary/20 px-4 py-6 text-center text-sm text-muted-foreground">
            正在加载场馆点位...
          </div>

          <div
            v-else-if="!selectedFloorId"
            class="rounded-md bg-secondary/20 px-4 py-6 text-center text-sm text-muted-foreground">
            {{ galleryEmptyMessage }}
          </div>

          <div v-else class="grid gap-3 xl:grid-cols-[minmax(0,1.15fr)_420px] xl:items-start">
            <MapVenueListEditor
              :venues="venueDrafts"
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
              :venues="venueDrafts"
              :active-venue-id="activeVenueId"
              :picking-venue-id="pickingVenueId"
              :draft-point="draftPoint"
              :map-image="selectedFloorMapImage"
              @select-venue="selectVenue"
              @capture-point="capturePoint"
              @update-venue-point="updateVenuePoint" />
          </div>
        </div>
      </AdminSectionCard>

      <AdminSectionCard
        v-else
        title="设施"
        description="维护当前主体下的公共设施，并可关联到指定楼层。">
        <div class="space-y-3">
          <div class="flex justify-end">
            <UiButton size="sm" :disabled="props.disabled || facilitySubmitting" @click="openCreateFacility">
              新增设施
            </UiButton>
          </div>

          <div
            v-if="activeSectionPending"
            class="rounded-md bg-secondary/20 px-4 py-6 text-center text-sm text-muted-foreground">
            正在加载设施数据...
          </div>

          <div
            v-else-if="!facilities.length"
            class="rounded-md bg-secondary/20 px-4 py-6 text-center text-sm text-muted-foreground">
            当前主体还没有设施。
          </div>

          <div v-else class="space-y-2">
            <article
              v-for="facility in facilities"
              :key="facility.id"
              class="grid gap-3 rounded-[0.9rem] border border-border/70 bg-secondary/20 px-4 py-3 md:grid-cols-[minmax(0,1fr)_170px]">
              <div class="space-y-1.5">
                <div class="flex flex-wrap items-center gap-2">
                  <p class="text-sm font-semibold text-foreground">{{ facility.name || '未命名设施' }}</p>
                  <span class="text-xs text-muted-foreground">类型 {{ facility.facilityType }}</span>
                </div>
                <div class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>所属楼层：{{ facility.floorName }}</span>
                  <span>排序：{{ facility.sortOrder }}</span>
                </div>
                <p class="text-xs leading-5 text-muted-foreground">
                  {{ facility.locationDesc || '未填写位置描述。' }}
                </p>
              </div>
              <div class="flex items-end justify-end gap-2">
                <UiButton variant="secondary" size="sm" @click="openEditFacility(facility)">
                  编辑
                </UiButton>
                <UiButton variant="ghost" size="sm" @click="removeFacility(facility)">
                  删除
                </UiButton>
              </div>
            </article>
          </div>
        </div>
      </AdminSectionCard>
    </template>

    <MuseumFloorDialog
      :open="floorDialogOpen"
      :mode="floorDialogMode"
      :initial-value="floorDraft"
      :submitting="floorSubmitting"
      @update:open="floorDialogOpen = $event"
      @save="saveFloor" />

    <Dialog :open="facilityDialogOpen" @update:open="facilityDialogOpen = $event">
      <DialogContent class="max-w-[760px] overflow-hidden p-0">
        <div class="border-b border-border/70 px-5 py-3">
          <DialogHeader class="space-y-0.5">
            <DialogTitle class="text-[1.05rem] font-semibold tracking-tight text-foreground">
              {{ facilityDialogMode === 'create' ? '新增设施' : '编辑设施' }}
            </DialogTitle>
            <DialogDescription class="text-xs text-muted-foreground">
              维护当前主体下的设施信息和所属楼层。
            </DialogDescription>
          </DialogHeader>
        </div>
        <form class="space-y-4 px-5 py-4" @submit.prevent="saveFacility">
          <section class="grid gap-3 md:grid-cols-2">
            <div class="space-y-2">
              <label class="text-sm font-medium text-foreground">设施名称</label>
              <UiInput v-model="facilityDraft.name" placeholder="请输入设施名称" />
            </div>
            <div class="space-y-2">
              <label class="text-sm font-medium text-foreground">所属楼层</label>
              <select
                v-model="facilityDraft.floorId"
                class="h-9 w-full rounded-md border border-border bg-secondary px-3 text-sm text-foreground transition-colors duration-200 focus:border-primary/45 focus:bg-accent">
                <option :value="null">未绑定楼层</option>
                <option v-for="option in floorOptions" :key="option.value" :value="option.value">
                  {{ option.label }}
                </option>
              </select>
            </div>
          </section>

          <section class="grid gap-3 md:grid-cols-2">
            <div class="space-y-2">
              <label class="text-sm font-medium text-foreground">设施类型</label>
              <select
                v-model="facilityDraft.facilityType"
                class="h-9 w-full rounded-md border border-border bg-secondary px-3 text-sm text-foreground transition-colors duration-200 focus:border-primary/45 focus:bg-accent">
                <option v-for="option in facilityTypeOptions" :key="option.value" :value="option.value">
                  {{ option.label }}
                </option>
              </select>
            </div>
            <div class="space-y-2">
              <label class="text-sm font-medium text-foreground">排序号</label>
              <input
                :value="facilityDraft.sortOrder"
                type="number"
                class="h-9 w-full rounded-md border border-border bg-secondary px-3 text-sm text-foreground transition-colors duration-200 focus:border-primary/45 focus:bg-accent"
                @input="updateFacilitySortOrder(($event.target as HTMLInputElement).value)">
            </div>
          </section>

          <section class="space-y-2">
            <label class="text-sm font-medium text-foreground">位置描述</label>
            <textarea
              v-model="facilityDraft.locationDesc"
              rows="3"
              class="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm leading-6 text-foreground transition-colors duration-200 focus:border-primary/45 focus:bg-accent"
              placeholder="请输入位置描述" />
          </section>

          <UiImageUpload
            v-model="facilityIconList"
            label="设施图标"
            hint="上传设施对应的图标素材。"
            button-text="上传图标"
            button-subtext="支持单张"
            :multiple="false"
            @uploaded="handleFacilityUploaded" />

          <div class="flex justify-end gap-2 border-t border-border/70 pt-3">
            <UiButton variant="ghost" type="button" @click="facilityDialogOpen = false">取消</UiButton>
            <UiButton type="submit" :disabled="facilitySubmitting">
              {{ facilitySubmitting ? '保存中...' : '保存设施' }}
            </UiButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  </div>
</template>
