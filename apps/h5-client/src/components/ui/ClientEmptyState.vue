<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import ClientButton from "./ClientButton.vue"
import ClientCard from "./ClientCard.vue"

interface Props {
  title: string
  description?: string
  actionText?: string
  class?: HTMLAttributes["class"]
}

const props = withDefaults(defineProps<Props>(), {
  description: "",
  actionText: "",
  class: undefined,
})

const emit = defineEmits<{
  action: []
}>()
</script>

<template>
  <ClientCard :class="props.class">
    <div class="space-y-4 p-5">
      <div class="space-y-2">
        <h2 class="text-xl font-display text-foreground">{{ props.title }}</h2>
        <p v-if="props.description" class="client-page-copy">{{ props.description }}</p>
      </div>

      <slot />

      <ClientButton v-if="props.actionText" variant="outline" class="w-full" @click="emit('action')">
        {{ props.actionText }}
      </ClientButton>
    </div>
  </ClientCard>
</template>
