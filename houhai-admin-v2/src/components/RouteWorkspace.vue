<script setup lang="ts">
import { ref } from 'vue'
import { X } from 'lucide-vue-next'
import type { CulturalPlace, Destination, TourRoute } from '../types'
import { cloneValue } from '../utils'
import IndoorArtifactRouteEditor from './IndoorArtifactRouteEditor.vue'
import OutdoorRouteEditor from './OutdoorRouteEditor.vue'

const props = defineProps<{ route: TourRoute; destination: Destination; places: CulturalPlace[]; indoorNames: Record<string,string> }>()
const emit = defineEmits<{ close: []; save: [value: TourRoute] }>()
const draft = ref<TourRoute>(cloneValue(props.route))
function submit() { emit('save', cloneValue(draft.value)); emit('close') }
</script>

<template>
  <div class="overlay" @click.self="emit('close')"><section class="route-dialog">
    <header class="dialog-head"><div><span class="eyebrow">路线编排工作台</span><h2>{{ draft.name }}</h2><p>{{ destination.name }} · {{ draft.code }}</p></div><div class="head-actions"><span :class="['status',draft.status]">{{ draft.status==='published'?'已上架':draft.status==='pending'?'待审核':'草稿' }}</span><button class="icon-button" @click="emit('close')"><X :size="19"/></button></div></header>
    <OutdoorRouteEditor v-if="draft.sceneType==='outdoor'" :route="draft" :destination="destination" :places="places" @close="emit('close')" @save="submit" />
    <IndoorArtifactRouteEditor v-else :route="draft" @close="emit('close')" @publish="submit" />
  </section></div>
</template>
