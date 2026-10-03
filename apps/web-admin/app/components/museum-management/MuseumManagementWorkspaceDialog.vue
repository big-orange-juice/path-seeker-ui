<script setup lang="ts">
import { computed, reactive, watch } from 'vue';
import Button from '@/components/shadcn/button/Button.vue';
import Dialog from '@/components/shadcn/dialog/Dialog.vue';
import DialogContent from '@/components/shadcn/dialog/DialogContent.vue';
import DialogDescription from '@/components/shadcn/dialog/DialogDescription.vue';
import DialogHeader from '@/components/shadcn/dialog/DialogHeader.vue';
import DialogTitle from '@/components/shadcn/dialog/DialogTitle.vue';
import MuseumWorkbenchPanels from '@/components/museum-management/MuseumWorkbenchPanels.vue';
import MuseumManagementForm from '@/components/museum-management/MuseumManagementForm.vue';
import CulturalPlacePanel from '@/components/museum-management/CulturalPlacePanel.vue';
import { isScenicVenue } from '@/utils/scenic-boundary';
import type { MuseumDraft } from '@/types/museum';

interface Props {
  open: boolean;
  mode: 'create' | 'edit';
  initialValue: MuseumDraft;
  submitting?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  submitting: false,
});

const emit = defineEmits<{
  'update:open': [value: boolean];
  save: [value: MuseumDraft];
}>();

const activeTab = defineModel<'basic' | 'floors' | 'facilities' | 'places'>('activeTab', {
  default: 'basic',
});

const formState = reactive<MuseumDraft>({
  museumCode: '',
  name: '',
  address: '',
  openingHours: '',
  closedDay: '',
  reservationInfo: '',
  officialWebsite: '',
  wechatAccount: '',
  contactPhone: '',
  longitude: null,
  latitude: null,
  landArea: null,
  buildingArea: null,
  exhibitionArea: null,
  floorsAbove: null,
  floorsBelow: null,
  intro: '',
  coverImageUrl: null,
  coverImageFileId: null,
  status: 1,
});

const scenic = computed(() => isScenicVenue(formState.venueType));
let museumCreateDraft: MuseumDraft;
let scenicCreateDraft: MuseumDraft;
const dialogTitle = computed(() => (props.mode === 'create' ? '新增景点' : scenic.value ? '景点工作台' : '博物馆工作台'));
const dialogDescription = computed(() =>
  props.mode === 'create'
    ? '选择博物馆或户外景点，保存后继续维护对应的路线资料。'
    : scenic.value ? '维护景点基础信息、地图范围、文化点和设施。' : '维护博物馆基础信息、楼层和设施。'
);

const tabItems = computed(() => [
  { key: 'basic', label: '基础信息' },
  ...([1, 3, 5].includes(formState.venueType ?? 1) ? [{ key: 'floors' as const, label: '楼层地图' }] : []),
  ...(scenic.value ? [{ key: 'places' as const, label: '文化点' }] : []),
  { key: 'facilities', label: '设施' },
] as const);

const syncFormState = (value: MuseumDraft) => {
  formState.id = value.id;
  formState.museumCode = value.museumCode;
  formState.name = value.name;
  formState.address = value.address;
  formState.openingHours = value.openingHours;
  formState.closedDay = value.closedDay;
  formState.reservationInfo = value.reservationInfo;
  formState.officialWebsite = value.officialWebsite;
  formState.wechatAccount = value.wechatAccount;
  formState.contactPhone = value.contactPhone;
  formState.longitude = value.longitude;
  formState.latitude = value.latitude;
  formState.landArea = value.landArea;
  formState.buildingArea = value.buildingArea;
  formState.exhibitionArea = value.exhibitionArea;
  formState.floorsAbove = value.floorsAbove;
  formState.floorsBelow = value.floorsBelow;
  formState.intro = value.intro;
  formState.coverImageUrl = value.coverImageUrl;
  formState.coverImageFileId = value.coverImageFileId;
  formState.status = value.status;
  formState.venueType = value.venueType ?? 1;
  formState.coordinateSystem = value.coordinateSystem ?? 1;
  formState.mapProvider = value.mapProvider ?? null;
  formState.boundaryGeoJson = value.boundaryGeoJson ?? null;
};

watch(
  () => props.initialValue,
  (value) => {
    syncFormState(value);
    museumCreateDraft = { ...value, venueType: 1 };
    scenicCreateDraft = { ...value, venueType: 4, coordinateSystem: 2, mapProvider: 1, boundaryGeoJson: null };
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

const changeCreateType = (type: 'museum' | 'scenic') => {
  if (props.submitting || props.mode !== 'create' || (type === 'scenic') === scenic.value) return;
  if (scenic.value) scenicCreateDraft = { ...formState };
  else museumCreateDraft = { ...formState };
  syncFormState(type === 'scenic' ? scenicCreateDraft : museumCreateDraft);
};

const resetBasic = () => {
  const wasScenic = scenic.value;
  syncFormState(props.initialValue);
  if (props.mode === 'create' && wasScenic) {
    formState.venueType = 4;
    formState.coordinateSystem = 2;
    formState.mapProvider = 1;
    formState.boundaryGeoJson = null;
  }
};

const submitBasic = () => {
  if (props.submitting) {
    return;
  }

  emit('save', { ...formState });
};

const activeWorkbenchSection = computed<'floors' | 'facilities'>(() => {
  if (activeTab.value === 'facilities') {
    return 'facilities';
  }

  return 'floors';
});
</script>

<template>
  <Dialog :open="props.open" @update:open="handleOpenChange">
    <DialogContent class="h-[92vh] max-w-[1180px] overflow-hidden p-0">
      <div class="flex h-full min-h-0 flex-col">
        <div class="flex items-center border-b border-border/70 px-5 py-3 pr-12">
          <DialogHeader class="space-y-0.5">
            <DialogTitle class="text-[1.2rem] font-semibold tracking-tight text-foreground">
              {{ dialogTitle }}
            </DialogTitle>
            <DialogDescription class="text-xs text-muted-foreground">
              {{ dialogDescription }}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div class="border-b border-border/70 px-5 py-2.5">
          <div v-if="props.mode === 'create'" class="flex gap-2" role="tablist" aria-label="景点类型">
            <button v-for="item in [{ key: 'museum', label: '博物馆（室内路线）' }, { key: 'scenic', label: '景点（户外路线）' }] as const" :key="item.key" type="button" role="tab" :aria-selected="(item.key === 'scenic') === scenic" :disabled="props.submitting" class="rounded-md border px-4 py-2 text-sm transition-colors" :class="(item.key === 'scenic') === scenic ? 'border-primary/35 bg-primary/10 text-foreground' : 'border-border text-muted-foreground'" @click="changeCreateType(item.key)">
              {{ item.label }}
            </button>
          </div>
          <div v-else class="flex flex-wrap gap-2">
            <button
              v-for="item in tabItems"
              :key="item.key"
              type="button"
              class="rounded-md border px-3 py-1.5 text-sm transition-colors"
              :class="
                activeTab === item.key
                  ? 'border-primary/35 bg-primary/10 text-foreground'
                  : 'border-border bg-secondary/30 text-muted-foreground hover:bg-secondary/45 hover:text-foreground'
              "
              @click="activeTab = item.key">
              {{ item.label }}
            </button>
          </div>
        </div>

        <div class="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <MuseumManagementForm
            v-if="activeTab === 'basic'"
            :key="scenic ? 'scenic' : 'museum'"
            :model-value="formState"
            @update:model-value="Object.assign(formState, $event)"
            :mode="props.mode"
            :submitting="props.submitting"
            @save="submitBasic"
            @reset="resetBasic" />

          <CulturalPlacePanel v-else-if="activeTab === 'places'" :museum-id="formState.id || ''" :disabled="props.submitting" />

          <MuseumWorkbenchPanels
            v-else
            :key="`${activeWorkbenchSection}:${formState.id || 'new'}`"
            :museum-id="formState.id"
            :section="activeWorkbenchSection"
            :disabled="props.submitting" />
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>
