<script setup lang="ts">
import { computed, ref } from 'vue'
import { MapPinned, Pencil, Plus, RefreshCw, Trash2, Undo2 } from 'lucide-vue-next'
import type { CulturalPlace, Destination } from '../types'
import MapCanvas from './MapCanvas.vue'

interface FloorPoint { id:string; x:number; y:number; title:string; code:string; type:'exhibit'|'note'; description:string }
const props = defineProps<{ destinations: Destination[]; places: CulturalPlace[] }>()
const emit = defineEmits<{ notify:[message:string] }>()
/** 默认展示北京·后海的真实地图（户外漫游目的地）。 */
const defaultDestination = props.destinations.find(item => item.code === 'BJ-HH-001') ?? props.destinations.find(item => item.sceneType === 'outdoor') ?? props.destinations[0]
const selectedMuseumId = ref(defaultDestination?.id ?? '')
const selectedGalleryId = ref(defaultDestination?.sceneType === 'outdoor' ? 'outdoor-area' : 'gallery-1')
const selectedMapId = ref(defaultDestination?.sceneType === 'outdoor' ? 'outdoor-map' : 'map-1')
const selectedPointId = ref('')
const picking = ref(false)
const zoom = ref(1)
const undoStack = ref<FloorPoint[][]>([])
const floorPoints = ref<FloorPoint[]>(Array.from({ length:46 }, (_,index) => ({
  id:`floor-point-${index+1}`,
  x:7+((index*19)%86),
  y:10+((index*29)%78),
  title:index%9===4?`展览说明 ${index+1}`:`内容点位 ${index+1}`,
  code:`RI${String(100004038+index)}`,
  type:index%9===4?'note':'exhibit',
  description:index%9===4?'展区主题与参观方向说明。':'关联内容，可点击查看文物详情。',
})))
const selectedMuseum = computed(() => props.destinations.find(item => item.id===selectedMuseumId.value) ?? props.destinations[0]!)
const isOutdoor = computed(() => selectedMuseum.value.sceneType==='outdoor')
const outdoorPlaces = computed(() => props.places.filter(item=>item.destinationId===selectedMuseumId.value))
const selectedFloorPoint = computed(() => floorPoints.value.find(item=>item.id===selectedPointId.value) ?? null)
const selectedOutdoorPoint = computed(() => outdoorPlaces.value.find(item=>item.id===selectedPointId.value) ?? null)
const pointCount = computed(() => isOutdoor.value ? outdoorPlaces.value.length : floorPoints.value.length)
function snapshot() { undoStack.value.push(floorPoints.value.map(item=>({...item}))); if(undoStack.value.length>30) undoStack.value.shift() }
function handleStageClick(event:MouseEvent) {
  if (!picking.value) return
  const target=event.currentTarget as HTMLElement
  const rect=target.getBoundingClientRect()
  snapshot()
  const index=floorPoints.value.length+1
  const point:FloorPoint={id:`floor-point-${Date.now()}`,x:(event.clientX-rect.left)/rect.width*100,y:(event.clientY-rect.top)/rect.height*100,title:`新增内容点位 ${index}`,code:`RI-NEW-${index}`,type:'exhibit',description:'待补充点位说明与关联内容。'}
  floorPoints.value.push(point);selectedPointId.value=point.id;picking.value=false;emit('notify','文物点位已新增')
}
function removePoint() { if(!selectedFloorPoint.value)return;snapshot();floorPoints.value=floorPoints.value.filter(item=>item.id!==selectedPointId.value);selectedPointId.value='';emit('notify','点位已删除，可使用撤销恢复') }
function undo() { const previous=undoStack.value.pop();if(!previous)return;floorPoints.value=previous;selectedPointId.value='';emit('notify','已撤销上一步点位操作') }
function changeMuseum() { selectedPointId.value='';picking.value=false;zoom.value=1;selectedGalleryId.value=isOutdoor.value?'outdoor-area':'gallery-1';selectedMapId.value=isOutdoor.value?'outdoor-map':'map-1' }
</script>

<template>
  <section class="gallery-map-page">
    <section class="gallery-map-filters">
      <label>所属景点<select v-model="selectedMuseumId" @change="changeMuseum"><option v-for="item in destinations" :key="item.id" :value="item.id">{{ item.name }}</option></select></label>
      <label>场景<select v-model="selectedGalleryId"><option :value="isOutdoor?'outdoor-area':'gallery-1'">{{ isOutdoor?'后海漫游区域':'G-FIX-60929 / 考古上海' }}</option></select></label>
      <label>地图<select v-model="selectedMapId"><option :value="isOutdoor?'outdoor-map':'map-1'">{{ isOutdoor?`后海真实地图 · ${pointCount} 个点位`:`RI00004038 · ${pointCount} 个点位` }}</option></select></label>
      <div class="gallery-map-actions"><button class="button primary" @click="picking=!picking"><MapPinned :size="15"/>{{ picking?'退出取点':'新增点位' }}</button><button class="button ghost" :disabled="!undoStack.length||isOutdoor" @click="undo"><Undo2 :size="15"/>撤销</button><button class="button ghost" @click="emit('notify','地图数据已刷新')"><RefreshCw :size="15"/>刷新</button></div>
    </section>

    <div class="gallery-map-summary">{{ isOutdoor?'北京·后海真实地图':'考古上海' }} · {{ pointCount }} 个点位<span v-if="!isOutdoor"> · 3629 × 1524</span><b v-if="picking">点击地图背景图取点</b></div>
    <div class="gallery-map-workspace">
      <section class="gallery-map-canvas-shell">
        <div v-if="isOutdoor" class="outdoor-gallery-map"><MapCanvas :destination="selectedMuseum" :places="outdoorPlaces" :active-place-id="selectedPointId" @select-place="selectedPointId=$event"/></div>
        <div v-else class="floor-map-viewport">
          <div class="floor-map-stage" :style="{transform:`scale(${zoom})`}" @click="handleStageClick">
            <svg viewBox="0 0 1000 410" preserveAspectRatio="none" aria-label="考古上海展厅平面图"><rect x="25" y="35" width="950" height="335" fill="#fff" stroke="#999" stroke-width="2"/><path d="M25 35 L25 120 L150 180 M975 35 L930 90 L965 120 L920 220 L975 265" fill="none" stroke="#8c8c8c" stroke-width="2"/><path d="M90 355 L180 280 L260 355 M330 355 L380 295 L470 355 M540 355 L580 295 L700 355 M735 355 L790 295 L900 355" fill="none" stroke="#989898" stroke-width="2"/><g fill="#dbe8f5"><rect v-for="index in 24" :key="index" :x="55+((index*79)%840)" :y="70+((index*47)%230)" width="42" height="16" :transform="`rotate(${index%2?'-28':'22'} ${55+((index*79)%840)} ${70+((index*47)%230)})`"/></g><g fill="#d20f36"><path d="M80 50 l28 -28 l28 28 h-10 v45 h-36 v-45z"/><path d="M860 50 l28 -28 l28 28 h-10 v45 h-36 v-45z"/></g><g fill="#fff" font-size="13"><text x="92" y="45">出口</text><text x="873" y="45">入口</text></g></svg>
            <button v-for="point in floorPoints" :key="point.id" :class="['floor-point',point.type,{active:point.id===selectedPointId}]" :style="{left:`${point.x}%`,top:`${point.y}%`}" @click.stop="selectedPointId=point.id"><span>{{ point.type==='note'?'✦':'•' }}</span></button>
          </div>
        </div>
        <div v-if="!isOutdoor" class="map-zoom"><button :disabled="zoom<=.6" @click="zoom=Math.max(.6,zoom-.1)">−</button><span>{{ Math.round(zoom*100) }}%</span><button :disabled="zoom>=2" @click="zoom=Math.min(2,zoom+.1)">+</button><button @click="zoom=1">重置</button></div>
      </section>

      <aside class="gallery-point-detail"><header><strong>点位详情</strong><div v-if="selectedFloorPoint&&!isOutdoor"><button><Pencil :size="14"/>编辑</button><button @click="removePoint"><Trash2 :size="14"/>删除</button></div></header><div v-if="!selectedFloorPoint&&!selectedOutdoorPoint" class="point-empty">点击地图上的点位查看详情。</div><div v-else-if="selectedFloorPoint&&!isOutdoor" class="point-content"><span class="scene-badge indoor">{{ selectedFloorPoint.type==='note'?'展览说明':'文物点位' }}</span><small>{{ selectedFloorPoint.x.toFixed(2) }}%, {{ selectedFloorPoint.y.toFixed(2) }}%</small><h3>{{ selectedFloorPoint.title }}</h3><p>{{ selectedFloorPoint.description }}</p><div><strong>关联文物</strong><article><div class="artifact-thumb">器</div><span><b>{{ selectedFloorPoint.title }}</b><small>{{ selectedFloorPoint.code }}</small><em>点击查看详情</em></span></article></div></div><div v-else-if="selectedOutdoorPoint" class="point-content"><span class="scene-badge outdoor">文化展示点</span><small>{{ selectedOutdoorPoint.latitude.toFixed(5) }}, {{ selectedOutdoorPoint.longitude.toFixed(5) }}</small><h3>{{ selectedOutdoorPoint.name }}</h3><p>{{ selectedOutdoorPoint.description }}</p><div><strong>导游讲解</strong><article v-for="narration in selectedOutdoorPoint.narrations" :key="narration.id"><div class="artifact-thumb">{{ narration.guideName.slice(0,1) }}</div><span><b>{{ narration.title }}</b><small>{{ narration.guideName }} · {{ narration.guideStyle }}</small><em>编辑讲解版本</em></span></article></div></div>
      </aside>
    </div>
  </section>
</template>
