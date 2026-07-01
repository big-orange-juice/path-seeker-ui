<script setup lang="ts">
import { computed, reactive, watch } from 'vue';
import Dialog from '@/components/shadcn/dialog/Dialog.vue';
import DialogContent from '@/components/shadcn/dialog/DialogContent.vue';
import DialogDescription from '@/components/shadcn/dialog/DialogDescription.vue';
import DialogHeader from '@/components/shadcn/dialog/DialogHeader.vue';
import DialogTitle from '@/components/shadcn/dialog/DialogTitle.vue';
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

const dialogTitle = computed(() => (props.mode === 'create' ? '新增主体' : '编辑主体'));
const dialogDescription = computed(() => '维护主体基础资料与对外展示所需的核心信息。');

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

const submitForm = (value: MuseumDraft) => {
  if (props.submitting) {
    return;
  }

  emit('save', {
    ...value,
    coverImageUrl: value.coverImageUrl,
    coverImageFileId: value.coverImageFileId,
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

        <UiButton variant="ghost" size="icon" :disabled="props.submitting" @click="closeDialog">
          <UiAppIcon name="x" class="h-4 w-4" />
        </UiButton>
      </div>

      <div class="max-h-[calc(90vh-61px)] overflow-y-auto px-5 py-4">
        <MuseumManagementForm
          v-model="formState"
          :mode="props.mode"
          :submitting="props.submitting"
          @save="submitForm"
          @reset="syncFormState(props.initialValue)" />
      </div>
    </DialogContent>
  </Dialog>
</template>
