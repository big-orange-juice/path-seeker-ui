<script setup lang="ts">
import { computed, ref } from 'vue'
import { Languages, X } from 'lucide-vue-next'
import { localeLabelOf, siblingRoutes } from '../domain/content'
import type { ArtifactStage, CulturalPlace, Destination, TourRoute } from '../types'
import { cloneValue } from '../utils'
import IndoorArtifactRouteEditor from './IndoorArtifactRouteEditor.vue'
import OutdoorRouteEditor from './OutdoorRouteEditor.vue'

const props = defineProps<{ route: TourRoute; destination: Destination; places: CulturalPlace[]; indoorNames: Record<string,string>; stages: ArtifactStage[]; routePool: TourRoute[] }>()
const emit = defineEmits<{ close: []; save: [value: TourRoute]; saveStage: [value: ArtifactStage]; removeStage: [id: string]; switchRoute: [value: TourRoute] }>()
const draft = ref<TourRoute>(cloneValue(props.route))
/** 一条路线一种语言：这里展示同线路的其它语言版本，可直接跳转编辑。 */
const versions = computed(() => siblingRoutes(draft.value, props.routePool))
function submit() { emit('save', cloneValue(draft.value)); emit('close') }
</script>

<template>
  <div class="overlay" @click.self="emit('close')"><section class="route-dialog">
    <header class="dialog-head"><div><span class="eyebrow">路线编排工作台</span><h2>{{ draft.name }}</h2><p>{{ destination.name }} · {{ draft.code }} · {{ draft.theme }} · 内容语言 {{ localeLabelOf(draft.locale) }}</p></div><div class="head-actions"><span class="content-locales" aria-label="同线路语言版本"><Languages :size="13" /><button v-for="item in versions" :key="item.id" type="button" :class="{ active: item.id === draft.id }" :title="`${localeLabelOf(item.locale)}：${item.name}`" @click="item.id === draft.id || emit('switchRoute', item)">{{ localeLabelOf(item.locale) }}</button></span><span :class="['status',draft.status]">{{ draft.status==='published'?'已上架':draft.status==='pending'?'待审核':'草稿' }}</span><button class="icon-button" @click="emit('close')"><X :size="19"/></button></div></header>
    <OutdoorRouteEditor v-if="draft.sceneType==='outdoor'" :route="draft" :destination="destination" :places="places" :stages="stages" @close="emit('close')" @save="submit" @save-stage="emit('saveStage',$event)" @remove-stage="emit('removeStage',$event)" />
    <IndoorArtifactRouteEditor v-else :route="draft" :stages="stages" @close="emit('close')" @publish="submit" @save-stage="emit('saveStage',$event)" @remove-stage="emit('removeStage',$event)" />
  </section></div>
</template>
