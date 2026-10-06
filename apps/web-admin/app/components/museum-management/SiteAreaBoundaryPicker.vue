<script setup lang="ts">
/**
 * 片区（景区区域）边界的划取组件。
 *
 * 设计依据：doc/b-admin-functional-optimization-plan.md §5.2 —— 「片区管理页同步支持地图划取，
 * 替换当前手填 GeoJSON 的方式」。组件与景点范围编辑共用 `BoundaryDrawCanvas`，
 * 几何解析与校验复用 `@/utils/scenic-boundary`（实现位于 `@path-seeker/ts-shared`），不新造几何实现。
 *
 * 坐标约定：`museum_site_area.boundary_geojson` 与其所属目的地使用同一坐标系
 * （后端 `CopyAreaBoundaryAsync` 即按该约定解释），因此父级必须传入目的地的 `coordinateSystem`。
 */
import { shallowRef, useTemplateRef } from 'vue'
import Button from '@/components/shadcn/button/Button.vue'
import Textarea from '@/components/shadcn/textarea/Textarea.vue'
import BoundaryDrawCanvas from '@/components/scenic-map/BoundaryDrawCanvas.vue'
import { parseBoundary } from '@/utils/scenic-boundary'

const props = withDefaults(defineProps<{
  disabled?: boolean
  /** 所属目的地坐标系：1=WGS84 2=GCJ-02 3=BD-09 */
  coordinateSystem?: number
  /** 目的地边界（WGS84），用于对齐并提示片区是否越界 */
  destinationBoundaryGeoJson?: string | null
  /** 片区中心参考点（按 coordinateSystem），可选 */
  center?: { longitude: number; latitude: number } | null
}>(), {
  disabled: false,
  coordinateSystem: 1,
  destinationBoundaryGeoJson: null,
  center: null,
})

const model = defineModel<string | null>({ default: null })
const canvas = useTemplateRef<InstanceType<typeof BoundaryDrawCanvas>>('canvas')
const mode = shallowRef<'idle' | 'draw' | 'edit'>('idle')
const drawCount = shallowRef(0)
const message = shallowRef('点击「手动划取边界」沿片区外沿逐点点击，或直接粘贴已有 GeoJSON。')
const error = shallowRef('')

function startDrawing() {
  if (props.disabled) return
  void canvas.value?.cancelDrawing()
  mode.value = 'draw'
  drawCount.value = 0
  error.value = ''
  message.value = '沿片区边界依次点击至少 3 个不同顶点，完成后点击「完成划区」。'
}

function finishDrawing() {
  if (canvas.value?.finishDrawing()) {
    mode.value = 'idle'
    drawCount.value = 0
    error.value = ''
    message.value = '已划定片区边界，保存后写入数据库。'
  }
}

function cancelDrawing() {
  void canvas.value?.cancelDrawing()
  drawCount.value = 0
  mode.value = 'idle'
}

function toggleEdit() {
  if (props.disabled) return
  if (mode.value === 'edit') {
    mode.value = 'idle'
    return
  }
  if (!parseBoundary(model.value)) {
    error.value = '请先划取或粘贴一个有效的多边形边界，再修改顶点。'
    return
  }
  void canvas.value?.cancelDrawing()
  mode.value = 'edit'
  error.value = ''
  message.value = '拖动蓝色顶点调整片区边界；松开顶点后自动校验几何，非法时会被拒绝。'
}

function clearBoundary() {
  model.value = null
  void canvas.value?.cancelDrawing()
  mode.value = 'idle'
  drawCount.value = 0
  message.value = '已清除片区边界。'
}

function onGeoJsonChange() {
  error.value = parseBoundary(model.value) || !model.value ? '' : 'GeoJSON 无效：需要闭合的 Polygon 或 MultiPolygon。'
}
</script>

<template>
  <section class="space-y-2 rounded-lg border border-border/70 p-3">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div class="min-w-0">
        <p class="text-sm font-medium">片区边界</p>
        <p class="text-xs text-muted-foreground">{{ model ? '已设置边界' : '尚未设置边界' }} · 高德地图 · 坐标系 {{ props.coordinateSystem }}</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <template v-if="mode === 'draw'">
          <Button type="button" size="sm" :disabled="drawCount < 3" @click="finishDrawing">完成划区（{{ drawCount }} 点）</Button>
          <Button type="button" size="sm" variant="outline" :disabled="!drawCount" @click="canvas?.undoVertex(); drawCount = Math.max(0, drawCount - 1)">撤销一点</Button>
          <Button type="button" size="sm" variant="ghost" @click="cancelDrawing">取消划区</Button>
        </template>
        <template v-else>
          <Button type="button" size="sm" variant="outline" :disabled="props.disabled" @click="startDrawing">
            {{ model ? '重新划取' : '手动划取边界' }}
          </Button>
          <Button type="button" size="sm" variant="outline" :disabled="props.disabled" @click="toggleEdit">
            {{ mode === 'edit' ? '结束顶点修改' : '修改顶点' }}
          </Button>
          <Button type="button" size="sm" variant="ghost" :disabled="props.disabled || !model" @click="clearBoundary">清除边界</Button>
        </template>
      </div>
    </div>

    <BoundaryDrawCanvas
      ref="canvas"
      height-class="h-[360px] rounded-lg border border-border/60"
      :center="props.center"
      :coordinate-system="props.coordinateSystem"
      :boundary-geo-json="model"
      :range-type="3"
      :destination-boundary-geo-json="props.destinationBoundaryGeoJson"
      :mode="mode"
      :disabled="props.disabled"
      @update:boundary-geo-json="model = $event"
      @draw-progress="drawCount = $event"
      @error="error = $event" />

    <p v-if="error" role="alert" class="text-xs text-destructive">{{ error }}</p>
    <p v-else class="text-xs text-muted-foreground">{{ message }}</p>

    <label class="grid gap-1.5 text-sm">
      <span class="text-xs text-muted-foreground">边界 GeoJSON（按目的地坐标系，可直接粘贴核对）</span>
      <Textarea
        :model-value="model || ''"
        rows="4"
        :disabled="props.disabled"
        placeholder="Polygon 或 MultiPolygon"
        @update:model-value="model = $event || null; onGeoJsonChange()" />
    </label>
  </section>
</template>
