<script setup lang="ts">
import Dialog from '@/components/shadcn/dialog/Dialog.vue';
import DialogContent from '@/components/shadcn/dialog/DialogContent.vue';
import DialogDescription from '@/components/shadcn/dialog/DialogDescription.vue';
import DialogHeader from '@/components/shadcn/dialog/DialogHeader.vue';
import DialogTitle from '@/components/shadcn/dialog/DialogTitle.vue';
import type { MuseumRecord } from '@/types/museum';

interface Props {
  open: boolean;
  record: MuseumRecord | null;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  'update:open': [value: boolean];
}>();

const formatValue = (value: number | string | null | undefined, suffix = '') => {
  if (value === null || value === undefined || value === '') {
    return '未填写';
  }

  return `${value}${suffix}`;
};
</script>

<template>
  <Dialog :open="props.open" @update:open="emit('update:open', $event)">
    <DialogContent class="max-h-[86vh] max-w-[920px] overflow-hidden p-0">
      <div v-if="props.record" class="flex max-h-[86vh] flex-col">
        <div class="flex items-center justify-between border-b border-border/70 px-5 py-3">
          <DialogHeader class="space-y-0.5">
            <DialogTitle class="text-[1.2rem] font-semibold tracking-tight text-foreground">
              {{ props.record.name || '主体详情' }}
            </DialogTitle>
            <DialogDescription class="text-xs text-muted-foreground">
              查看主体完整资料与补充说明。
            </DialogDescription>
          </DialogHeader>

          <UiButton variant="ghost" size="icon" @click="emit('update:open', false)">
            <UiAppIcon name="x" class="h-4 w-4" />
          </UiButton>
        </div>

        <div class="overflow-y-auto px-5 py-4">
          <div class="grid gap-4 md:grid-cols-2">
            <section class="space-y-3 rounded-[0.9rem] border border-border/70 bg-secondary/20 p-4">
              <h3 class="text-sm font-semibold text-foreground">基础信息</h3>
              <div class="grid gap-2 text-sm text-muted-foreground">
                <p>主体编码：{{ formatValue(props.record.museumCode) }}</p>
                <p>主体名称：{{ formatValue(props.record.name) }}</p>
                <p>状态：{{ props.record.status === 1 ? '启用' : '停用' }}</p>
                <p>地址：{{ formatValue(props.record.address) }}</p>
                <p>开放时间：{{ formatValue(props.record.openingHours) }}</p>
                <p>闭馆日：{{ formatValue(props.record.closedDay) }}</p>
                <p>联系电话：{{ formatValue(props.record.contactPhone) }}</p>
                <p>微信公众号：{{ formatValue(props.record.wechatAccount) }}</p>
                <p>官方网站：{{ formatValue(props.record.officialWebsite) }}</p>
                <p>预约说明：{{ formatValue(props.record.reservationInfo) }}</p>
              </div>
            </section>

            <section class="space-y-3 rounded-[0.9rem] border border-border/70 bg-secondary/20 p-4">
              <h3 class="text-sm font-semibold text-foreground">空间信息</h3>
              <div class="grid gap-2 text-sm text-muted-foreground">
                <p>经度：{{ formatValue(props.record.longitude) }}</p>
                <p>纬度：{{ formatValue(props.record.latitude) }}</p>
                <p>占地面积：{{ formatValue(props.record.landArea, ' m²') }}</p>
                <p>建筑面积：{{ formatValue(props.record.buildingArea, ' m²') }}</p>
                <p>展览面积：{{ formatValue(props.record.exhibitionArea, ' m²') }}</p>
                <p>地上层数：{{ formatValue(props.record.floorsAbove, ' 层') }}</p>
                <p>地下层数：{{ formatValue(props.record.floorsBelow, ' 层') }}</p>
              </div>
            </section>
          </div>

          <section class="mt-4 space-y-3 rounded-[0.9rem] border border-border/70 bg-secondary/20 p-4">
            <h3 class="text-sm font-semibold text-foreground">主体简介</h3>
            <p class="text-sm leading-7 text-muted-foreground">
              {{ props.record.intro || '未填写主体简介。' }}
            </p>
          </section>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>
