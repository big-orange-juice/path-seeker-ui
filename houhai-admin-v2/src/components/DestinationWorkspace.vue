<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Building2, MapPinned, Plus, Save, X } from 'lucide-vue-next'
import type { CulturalPlace, Destination, Narration } from '../types'
import { cloneValue } from '../utils'
import MapCanvas from './MapCanvas.vue'

const props = defineProps<{ destination: Destination; places: CulturalPlace[]; indoorSpaces: { id:string;name:string;kind:string;description:string }[] }>()
const emit = defineEmits<{ close: []; saveDestination: [value: Destination]; savePlace: [value: CulturalPlace]; saveNarration: [placeId:string,value:Narration] }>()
const draft = ref<Destination>(cloneValue(props.destination))
const tab = ref<'basic'|'content'>('basic')
const activePlaceId = ref(props.places[0]?.id ?? '')
const editingNarration = ref<Narration | null>(null)
watch(() => props.destination, value => { draft.value = cloneValue(value) })
const activePlace = computed(() => props.places.find(item => item.id === activePlaceId.value) ?? null)
const newNarration = (): Narration => ({ id:'',guideId:'guide-new',guideName:'',guideStyle:'',title:'',durationSeconds:120,script:'',audioUrl:null,status:'draft' })
function saveBasic() { emit('saveDestination', cloneValue(draft.value)) }
function updatePlace(field: 'description'|'address'|'recommendedMinutes', value: string | number) {
  if (!activePlace.value) return
  emit('savePlace', { ...activePlace.value, [field]: value })
}
function saveNarration() {
  if (!activePlace.value || !editingNarration.value) return
  emit('saveNarration', activePlace.value.id, cloneValue(editingNarration.value))
  editingNarration.value = null
}
function editNarration(item: Narration) { editingNarration.value = cloneValue(item) }
</script>

<template>
  <div class="overlay" @click.self="emit('close')">
    <section class="workspace-dialog">
      <header class="dialog-head">
        <div><span class="eyebrow">博物馆工作台</span><h2>{{ draft.name }}</h2><p>{{ draft.sceneType === 'outdoor' ? '户外漫游场景' : '场馆探索场景' }} · {{ draft.code }}</p></div>
        <button class="icon-button" aria-label="关闭" @click="emit('close')"><X :size="19" /></button>
      </header>
      <nav class="dialog-tabs">
        <button :class="{active:tab==='basic'}" @click="tab='basic'">基础信息</button>
        <button :class="{active:tab==='content'}" @click="tab='content'">{{ draft.sceneType === 'outdoor' ? '文化点与讲解' : '楼层与展厅' }}</button>
      </nav>
      <div v-if="tab==='basic'" class="dialog-body form-page">
        <div class="section-heading"><div><h3>通用资料</h3><p>沿用现有博物馆基础资料与发布状态。</p></div><span class="scene-chip"><MapPinned v-if="draft.sceneType==='outdoor'" :size="14"/><Building2 v-else :size="14"/>{{ draft.sceneType==='outdoor'?'户外漫游':'场馆探索' }}</span></div>
        <div class="form-grid">
          <label>博物馆名称<input v-model="draft.name" /></label><label>博物馆编码<input v-model="draft.code" /></label>
          <label class="wide">地址<input v-model="draft.address" /></label><label>开放时间<input v-model="draft.openingHours" /></label>
          <label>启用状态<select v-model="draft.status"><option value="enabled">启用</option><option value="disabled">停用</option></select></label>
          <label class="wide">简介<textarea v-model="draft.intro" rows="3" /></label>
        </div>
        <div v-if="draft.sceneType==='outdoor'" class="subsection">
          <div class="section-heading"><div><h3>户外地图配置</h3><p>地图供应商、坐标系和服务边界仅在户外场景出现。</p></div></div>
          <div class="form-grid"><label>地图供应商<select v-model="draft.mapProvider"><option>OpenStreetMap</option><option>Tencent</option></select></label><label>坐标系<select v-model="draft.coordinateSystem"><option>WGS84</option><option>GCJ02</option></select></label><label>中心经度<input v-model.number="draft.longitude" type="number" step="0.000001" /></label><label>中心纬度<input v-model.number="draft.latitude" type="number" step="0.000001" /></label><label class="wide">服务边界 GeoJSON<textarea v-model="draft.boundaryGeoJson" rows="3" /></label></div>
        </div>
        <footer class="dialog-actions"><button class="button ghost" @click="emit('close')">取消</button><button class="button primary" @click="saveBasic"><Save :size="16"/>保存资料</button></footer>
      </div>

      <div v-else-if="draft.sceneType==='outdoor'" class="dialog-body outdoor-layout">
        <aside class="place-list"><div class="list-title"><div><strong>文化展示点</strong><span>{{ places.length }} 个点位</span></div><button class="mini-button"><Plus :size="14"/>新增</button></div><button v-for="(place,index) in places" :key="place.id" :class="['place-row',{active:place.id===activePlaceId}]" @click="activePlaceId=place.id"><span class="place-order">{{ String(index+1).padStart(2,'0') }}</span><span><strong>{{ place.name }}</strong><small>{{ place.category }} · {{ place.narrations.length }} 版讲解</small></span></button></aside>
        <main class="place-editor" v-if="activePlace">
          <div class="map-panel"><MapCanvas :destination="draft" :places="places" :active-place-id="activePlaceId" @select-place="activePlaceId=$event"/><div class="map-caption"><strong>{{ activePlace.name }}</strong><span>{{ activePlace.latitude.toFixed(5) }}, {{ activePlace.longitude.toFixed(5) }}</span></div></div>
          <section class="editor-scroll">
            <div class="section-heading compact"><div><h3>{{ activePlace.name }}</h3><p>{{ activePlace.code }} · {{ activePlace.address }}</p></div><span class="status published">已发布</span></div>
            <div class="form-grid compact"><label class="wide">点位介绍<textarea :value="activePlace.description" rows="2" @change="updatePlace('description',($event.target as HTMLTextAreaElement).value)" /></label><label>建议停留（分钟）<input :value="activePlace.recommendedMinutes" type="number" @change="updatePlace('recommendedMinutes',Number(($event.target as HTMLInputElement).value))" /></label><label>到访地址<input :value="activePlace.address" @change="updatePlace('address',($event.target as HTMLInputElement).value)" /></label></div>
            <div class="narration-head"><div><h3>导游讲解版本</h3><p>同一文化点可由多位导游提供不同风格。</p></div><button class="button secondary small" @click="editingNarration=newNarration()"><Plus :size="15"/>新增讲解</button></div>
            <div class="narration-grid"><article v-for="item in activePlace.narrations" :key="item.id" class="narration-card"><div class="avatar">{{ item.guideName.slice(0,1) }}</div><div><strong>{{ item.title }}</strong><p>{{ item.guideName }} · {{ item.guideStyle }} · {{ Math.ceil(item.durationSeconds/60) }} 分钟</p><span>{{ item.script }}</span></div><button @click="editNarration(item)">编辑</button></article></div>
          </section>
        </main>
      </div>

      <div v-else class="dialog-body indoor-page"><div class="section-heading"><div><h3>场馆空间</h3><p>原有楼层、展厅与设施工作流保持不变。</p></div><button class="button secondary small"><Plus :size="15"/>新增空间</button></div><div class="indoor-grid"><article v-for="space in indoorSpaces" :key="space.id"><span>{{ space.kind==='floor'?'楼层':space.kind==='gallery'?'展厅':'设施' }}</span><h3>{{ space.name }}</h3><p>{{ space.description }}</p><button>编辑</button></article></div></div>
    </section>
    <div v-if="editingNarration" class="nested-modal"><section><header><div><span class="eyebrow">讲解版本</span><h3>{{ editingNarration.id ? '编辑导游讲解' : '新增导游讲解' }}</h3></div><button class="icon-button" @click="editingNarration=null"><X :size="18"/></button></header><div class="form-grid"><label>导游姓名<input v-model="editingNarration.guideName" /></label><label>讲解风格<input v-model="editingNarration.guideStyle" /></label><label class="wide">讲解标题<input v-model="editingNarration.title" /></label><label>时长（秒）<input v-model.number="editingNarration.durationSeconds" type="number" /></label><label>状态<select v-model="editingNarration.status"><option value="draft">草稿</option><option value="pending">待审核</option><option value="published">已发布</option></select></label><label class="wide">讲解词<textarea v-model="editingNarration.script" rows="7" /></label></div><footer><button class="button ghost" @click="editingNarration=null">取消</button><button class="button primary" @click="saveNarration"><Save :size="15"/>保存版本</button></footer></section></div>
  </div>
</template>
