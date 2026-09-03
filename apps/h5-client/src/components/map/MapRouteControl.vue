<script setup lang="ts">
import { Route } from 'lucide-vue-next'
defineProps<{ count: number; selected: boolean }>()
defineEmits<{ open: [] }>()
</script>
<template><button type="button" class="map-fab map-route-fab" @click="$emit('open')"><Route /><span>{{ selected ? '切换路线' : `路线 ${count}` }}</span></button></template>
<style scoped>.map-fab{display:flex;min-height:44px;align-items:center;gap:.45rem;border:1px solid rgba(230,188,105,.62);border-radius:999px;background:rgba(20,17,12,.9);padding:.65rem .85rem;color:#f1cf88;box-shadow:0 8px 22px rgba(0,0,0,.3);backdrop-filter:blur(10px)}.map-fab svg{width:1rem;height:1rem}.map-fab span{font-size:.75rem;font-weight:650}</style>
