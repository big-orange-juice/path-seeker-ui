<script setup lang="ts">
import { computed, shallowRef } from 'vue';
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

/** 冷字段默认折叠：经纬度、面积、编码等（M-02） */
const showMoreFields = shallowRef(false);

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
    <section class="space-y-2">
      <label class="text-sm font-medium">博物馆名称</label>
      <Input v-model="model.name" placeholder="请输入博物馆名称" />
    </section>

    <section class="space-y-2">
      <label class="text-sm font-medium">地址</label>
      <Input v-model="model.address" placeholder="请输入博物馆地址" />
    </section>

    <section class="grid gap-3 md:grid-cols-2">
      <div class="space-y-2">
        <label class="text-sm font-medium">开放时间</label>
        <Input v-model="model.openingHours" placeholder="如 10:00 - 18:00" />
      </div>
      <div class="space-y-2">
        <label class="text-sm font-medium">闭馆日</label>
        <Input v-model="model.closedDay" placeholder="如 每周一" />
      </div>
    </section>

    <section class="grid gap-3 md:grid-cols-2">
      <div class="space-y-2">
        <label class="text-sm font-medium">联系电话</label>
        <Input v-model="model.contactPhone" placeholder="请输入联系电话" />
      </div>
      <div class="space-y-2">
        <label class="text-sm font-medium">状态</label>
        <Select :model-value="String(model.status)" @update:model-value="model.status = Number($event)">
          <option value="1">启用</option>
          <option value="2">停用</option>
        </Select>
      </div>
    </section>

    <section class="space-y-2">
      <label class="text-sm font-medium">简介</label>
      <Textarea
        v-model="model.intro"
        rows="4"
        placeholder="请输入博物馆简介" />
    </section>

    <UiImageUpload
      v-model="coverImageList"
      label="封面"
      hint="上传一张封面图，用于后台概览与入口展示。"
      button-text="上传封面"
      button-subtext="支持 JPG / PNG"
      :multiple="false"
      @uploaded="handleUpload" />

    <div class="rounded-lg border border-border/60 bg-background/30">
      <button
        type="button"
        class="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm text-muted-foreground transition hover:text-foreground"
        @click="showMoreFields = !showMoreFields">
        <span>更多资料</span>
        <span class="text-xs">{{ showMoreFields ? '收起' : '展开' }}</span>
      </button>

      <div v-if="showMoreFields" class="space-y-4 border-t border-border/50 px-3 py-3">
        <section class="grid gap-3 md:grid-cols-3">
          <div class="space-y-2"><label class="text-sm font-medium">场馆类型</label><Select :model-value="String(model.venueType ?? 1)" @update:model-value="model.venueType = Number($event)"><option value="1">传统博物馆</option><option value="2">古镇景区</option><option value="3">混合场馆</option></Select></div>
          <div class="space-y-2"><label class="text-sm font-medium">坐标系</label><Select :model-value="String(model.coordinateSystem ?? 1)" @update:model-value="model.coordinateSystem = Number($event)"><option value="1">WGS84</option><option value="2">GCJ02</option><option value="3">BD09</option></Select></div>
          <div class="space-y-2"><label class="text-sm font-medium">地图供应商</label><Select :model-value="String(model.mapProvider ?? '')" @update:model-value="model.mapProvider = $event ? Number($event) : null"><option value="">未指定</option><option value="1">高德地图</option><option value="2">腾讯地图</option><option value="3">百度地图</option></Select></div>
        </section>
        <section class="grid gap-3 md:grid-cols-2">
          <div class="space-y-2">
            <label class="text-sm font-medium">博物馆编码</label>
            <Input v-model="model.museumCode" placeholder="如 SHM-EAST" />
          </div>
          <div class="space-y-2">
            <label class="text-sm font-medium">微信公众号</label>
            <Input v-model="model.wechatAccount" placeholder="请输入公众号名称" />
          </div>
        </section>
        <section class="space-y-2"><label class="text-sm font-medium">景区边界 GeoJSON</label><Textarea :model-value="model.boundaryGeoJson ?? ''" rows="4" placeholder="可填写 Polygon 或 MultiPolygon" @update:model-value="model.boundaryGeoJson = $event || null" /></section>

        <section class="grid gap-3 md:grid-cols-2">
          <div class="space-y-2">
            <label class="text-sm font-medium">官方网站</label>
            <Input v-model="model.officialWebsite" placeholder="请输入官网地址" />
          </div>
          <div class="space-y-2">
            <label class="text-sm font-medium">预约说明</label>
            <Input v-model="model.reservationInfo" placeholder="请输入预约说明" />
          </div>
        </section>

        <section class="grid gap-3 md:grid-cols-2">
          <div class="space-y-2">
            <label class="text-sm font-medium">经度</label>
            <Input
              :model-value="model.longitude === null ? '' : String(model.longitude)"
              type="number"
              step="0.000001"
              placeholder="请输入经度"
              @update:model-value="updateNumber('longitude', $event)" />
          </div>
          <div class="space-y-2">
            <label class="text-sm font-medium">纬度</label>
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
            <label class="text-sm font-medium">占地面积</label>
            <Input
              :model-value="model.landArea === null ? '' : String(model.landArea)"
              type="number"
              step="0.01"
              placeholder="平方米"
              @update:model-value="updateNumber('landArea', $event)" />
          </div>
          <div class="space-y-2">
            <label class="text-sm font-medium">建筑面积</label>
            <Input
              :model-value="model.buildingArea === null ? '' : String(model.buildingArea)"
              type="number"
              step="0.01"
              placeholder="平方米"
              @update:model-value="updateNumber('buildingArea', $event)" />
          </div>
          <div class="space-y-2">
            <label class="text-sm font-medium">展览面积</label>
            <Input
              :model-value="model.exhibitionArea === null ? '' : String(model.exhibitionArea)"
              type="number"
              step="0.01"
              placeholder="平方米"
              @update:model-value="updateNumber('exhibitionArea', $event)" />
          </div>
        </section>

        <section class="grid gap-3 md:grid-cols-2">
          <div class="space-y-2">
            <label class="text-sm font-medium">地上层数</label>
            <Input
              :model-value="model.floorsAbove === null ? '' : String(model.floorsAbove)"
              type="number"
              step="1"
              placeholder="请输入地上层数"
              @update:model-value="updateNumber('floorsAbove', $event)" />
          </div>
          <div class="space-y-2">
            <label class="text-sm font-medium">地下层数</label>
            <Input
              :model-value="model.floorsBelow === null ? '' : String(model.floorsBelow)"
              type="number"
              step="1"
              placeholder="请输入地下层数"
              @update:model-value="updateNumber('floorsBelow', $event)" />
          </div>
        </section>
      </div>
    </div>

    <div class="flex flex-wrap justify-end gap-2 border-t border-border/70 pt-3">
      <Button variant="ghost" :disabled="props.submitting" @click="emit('reset')">
        重置
      </Button>
      <Button type="submit" :disabled="props.submitting">
        {{ props.submitting ? '保存中...' : props.mode === 'create' ? '创建博物馆' : '保存修改' }}
      </Button>
    </div>
  </form>
</template>
