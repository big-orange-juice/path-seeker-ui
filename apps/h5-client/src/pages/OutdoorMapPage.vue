<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import TourExperience from '@/components/tour/TourExperience.vue'

const route = useRoute()
const museumId = computed(() => typeof route.params.museumId === 'string' ? route.params.museumId : '')
</script>

<template><TourExperience :key="museumId" :museum-id="museumId" /></template>
