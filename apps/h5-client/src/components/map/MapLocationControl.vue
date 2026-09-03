<script setup lang="ts">
import { LocateFixed, LoaderCircle } from 'lucide-vue-next'
defineProps<{ pending: boolean }>()
defineEmits<{ locate: [] }>()
</script>
<template><button type="button" class="location-control" :disabled="pending" aria-label="定位到我" @click="$emit('locate')"><LoaderCircle v-if="pending" class="spin" /><LocateFixed v-else /></button></template>
<style scoped>.location-control{display:grid;width:44px;height:44px;place-items:center;border:1px solid rgba(230,188,105,.5);border-radius:50%;background:rgba(20,17,12,.9);color:#f1cf88;box-shadow:0 8px 22px rgba(0,0,0,.28)}.location-control svg{width:1.1rem;height:1.1rem}.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}</style>
