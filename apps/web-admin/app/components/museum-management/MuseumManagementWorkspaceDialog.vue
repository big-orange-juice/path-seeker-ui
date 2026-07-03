<script setup lang="ts">
import { computed, reactive, watch } from 'vue';
import Button from '@/components/shadcn/button/Button.vue';
import Dialog from '@/components/shadcn/dialog/Dialog.vue';
import DialogContent from '@/components/shadcn/dialog/DialogContent.vue';
import DialogDescription from '@/components/shadcn/dialog/DialogDescription.vue';
import DialogHeader from '@/components/shadcn/dialog/DialogHeader.vue';
import DialogTitle from '@/components/shadcn/dialog/DialogTitle.vue';
import MuseumWorkbenchPanels from '@/components/museum-management/MuseumWorkbenchPanels.vue';
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

const activeTab = defineModel<'basic' | 'floors' | 'facilities'>('activeTab', {
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

const dialogTitle = computed(() => (props.mode === 'create' ? '新增主体' : '主体工作台'));
const dialogDescription = computed(() =>
  props.mode === 'create'
    ? '先保存主体基础信息，再继续维护楼层和设施。'
    : '在同一个主体工作台中维护基础信息、楼层和设施。'
);

const tabItems = [
  { key: 'basic', label: '基础信息' },
  { key: 'floors', label: '楼层地图' },
  { key: 'facilities', label: '设施' },
] as const;

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
};

watch(
  () => props.initialValue,
  (value) => {
    syncFormState(value);
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

const submitBasic = (...args: unknown[]) => {
  const value = args[0] as MuseumDraft;
  if (props.submitting) {
    return;
  }

  emit('save', value);
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

        <div class="border-b border-border/70 px-5 py-2.5">
          <div class="flex flex-wrap gap-2">
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
            v-model="formState"
            :mode="props.mode"
            :submitting="props.submitting"
            @save="submitBasic"
            @reset="syncFormState(props.initialValue)" />

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
