<script setup lang="ts">
import { computed } from 'vue';
import Button from '@/components/shadcn/button/Button.vue';
import Input from '@/components/shadcn/input/Input.vue';
import Select from '@/components/shadcn/select/Select.vue';
import Textarea from '@/components/shadcn/textarea/Textarea.vue';
import type { UploadAttachment } from '@/types/upload';
import type { MuseumDraft } from '@/types/museum';

interface Props {
  mode: 'create' | 'edit';
  submitting?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  submitting: false,
});

const model = defineModel<MuseumDraft>({ required: true });

const emit = defineEmits<{
  save: [];
  reset: [];
}>();

type NumericField =
  | 'longitude'
  | 'latitude'
  | 'landArea'
  | 'buildingArea'
  | 'exhibitionArea'
  | 'floorsAbove'
  | 'floorsBelow';

const coverImageList = computed({
  get: () => (model.value.coverImageUrl ? [model.value.coverImageUrl] : []),
  set: (value: string[]) => {
    model.value.coverImageUrl = value[0] ?? null;
    if (!value.length) {
      model.value.coverImageFileId = null;
    }
  },
});

const handleUpload = (files: UploadAttachment[]) => {
  const firstFile = files[0];
  if (!firstFile) {
    return;
  }

  model.value.coverImageUrl = firstFile.fileUrl;
  model.value.coverImageFileId = firstFile.fileId;
};

const updateNumber = (field: NumericField, value: string) => {
  model.value[field] = value === '' ? null : Number(value);
};
</script>

<template>
  <form class="space-y-4" @submit.prevent="emit('save')">
    <section class="grid gap-3 md:grid-cols-2">
      <div class="space-y-2">
        <label class="text-sm font-medium text-foreground">主体编码</label>
        <Input v-model="model.museumCode" placeholder="如 SHM-EAST" />
      </div>
      <div class="space-y-2">
        <label class="text-sm font-medium text-foreground">主体名称</label>
        <Input v-model="model.name" placeholder="请输入主体名称" />
      </div>
    </section>

    <section class="space-y-2">
      <label class="text-sm font-medium text-foreground">主体地址</label>
      <Input v-model="model.address" placeholder="请输入主体地址" />
    </section>

    <section class="grid gap-3 md:grid-cols-2">
      <div class="space-y-2">
        <label class="text-sm font-medium text-foreground">开放时间</label>
        <Input v-model="model.openingHours" placeholder="如 10:00 - 18:00" />
      </div>
      <div class="space-y-2">
        <label class="text-sm font-medium text-foreground">闭馆日</label>
        <Input v-model="model.closedDay" placeholder="如 每周一" />
      </div>
    </section>

    <section class="grid gap-3 md:grid-cols-2">
      <div class="space-y-2">
        <label class="text-sm font-medium text-foreground">联系电话</label>
        <Input v-model="model.contactPhone" placeholder="请输入联系电话" />
      </div>
      <div class="space-y-2">
        <label class="text-sm font-medium text-foreground">微信公众号</label>
        <Input v-model="model.wechatAccount" placeholder="请输入公众号名称" />
      </div>
    </section>

    <section class="grid gap-3 md:grid-cols-2">
      <div class="space-y-2">
        <label class="text-sm font-medium text-foreground">官方网站</label>
        <Input v-model="model.officialWebsite" placeholder="请输入官网地址" />
      </div>
      <div class="space-y-2">
        <label class="text-sm font-medium text-foreground">预约说明</label>
        <Input v-model="model.reservationInfo" placeholder="请输入预约说明" />
      </div>
    </section>

    <section class="grid gap-3 md:grid-cols-2">
      <div class="space-y-2">
        <label class="text-sm font-medium text-foreground">经度</label>
        <Input
          :model-value="model.longitude === null ? '' : String(model.longitude)"
          type="number"
          step="0.000001"
          placeholder="请输入经度"
          @update:model-value="updateNumber('longitude', $event)" />
      </div>
      <div class="space-y-2">
        <label class="text-sm font-medium text-foreground">纬度</label>
        <Input
          :model-value="model.latitude === null ? '' : String(model.latitude)"
          type="number"
          step="0.000001"
          placeholder="请输入纬度"
          @update:model-value="updateNumber('latitude', $event)" />
      </div>
    </section>

    <section class="grid gap-3 md:grid-cols-3">
      <div class="space-y-2">
        <label class="text-sm font-medium text-foreground">占地面积</label>
        <Input
          :model-value="model.landArea === null ? '' : String(model.landArea)"
          type="number"
          step="0.01"
          placeholder="平方米"
          @update:model-value="updateNumber('landArea', $event)" />
      </div>
      <div class="space-y-2">
        <label class="text-sm font-medium text-foreground">建筑面积</label>
        <Input
          :model-value="model.buildingArea === null ? '' : String(model.buildingArea)"
          type="number"
          step="0.01"
          placeholder="平方米"
          @update:model-value="updateNumber('buildingArea', $event)" />
      </div>
      <div class="space-y-2">
        <label class="text-sm font-medium text-foreground">展览面积</label>
        <Input
          :model-value="model.exhibitionArea === null ? '' : String(model.exhibitionArea)"
          type="number"
          step="0.01"
          placeholder="平方米"
          @update:model-value="updateNumber('exhibitionArea', $event)" />
      </div>
    </section>

    <section class="grid gap-3 md:grid-cols-3">
      <div class="space-y-2">
        <label class="text-sm font-medium text-foreground">地上层数</label>
        <Input
          :model-value="model.floorsAbove === null ? '' : String(model.floorsAbove)"
          type="number"
          step="1"
          placeholder="请输入地上层数"
          @update:model-value="updateNumber('floorsAbove', $event)" />
      </div>
      <div class="space-y-2">
        <label class="text-sm font-medium text-foreground">地下层数</label>
        <Input
          :model-value="model.floorsBelow === null ? '' : String(model.floorsBelow)"
          type="number"
          step="1"
          placeholder="请输入地下层数"
          @update:model-value="updateNumber('floorsBelow', $event)" />
      </div>
      <div class="space-y-2">
        <label class="text-sm font-medium text-foreground">状态</label>
        <Select :model-value="String(model.status)" @update:model-value="model.status = Number($event)">
          <option value="1">启用</option>
          <option value="2">停用</option>
        </Select>
      </div>
    </section>

    <section class="space-y-2">
      <label class="text-sm font-medium text-foreground">主体简介</label>
      <Textarea
        v-model="model.intro"
        rows="4"
        placeholder="请输入主体简介" />
    </section>

    <UiImageUpload
      v-model="coverImageList"
      label="主体封面"
      hint="上传一张主体封面图，用于后台概览和后续 C 端入口视觉。"
      button-text="上传封面"
      button-subtext="支持 JPG / PNG"
      :multiple="false"
      @uploaded="handleUpload" />

    <div class="flex flex-wrap justify-end gap-2 border-t border-border/70 pt-3">
      <Button variant="ghost" :disabled="props.submitting" @click="emit('reset')">
        重置
      </Button>
      <Button type="submit" :disabled="props.submitting">
        {{ props.submitting ? '保存中...' : props.mode === 'create' ? '创建主体' : '保存修改' }}
      </Button>
    </div>
  </form>
</template>

