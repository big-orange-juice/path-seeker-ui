<script setup lang="ts">
import { computed } from "vue"
import { CheckCircle2, CircleAlert, Info, X, TriangleAlert } from "lucide-vue-next"
import { useToastStore, type ToastItem } from "@path-seeker/client-state"

const toastStore = useToastStore()

function toneClasses(item: ToastItem) {
  if (item.tone === "success") {
    return "border-emerald-500/25 bg-emerald-500/12 text-emerald-50"
  }

  if (item.tone === "warning") {
    return "border-amber-500/25 bg-amber-500/12 text-amber-50"
  }

  if (item.tone === "error") {
    return "border-rose-500/25 bg-rose-500/12 text-rose-50"
  }

  return "border-primary/20 bg-card/95 text-foreground"
}

function iconComponent(item: ToastItem) {
  if (item.tone === "success") {
    return CheckCircle2
  }

  if (item.tone === "warning") {
    return TriangleAlert
  }

  if (item.tone === "error") {
    return CircleAlert
  }

  return Info
}

const items = computed(() => toastStore.items)
</script>

<template>
  <Teleport to="body">
    <div
      v-if="items.length"
      class="pointer-events-none fixed inset-x-0 top-4 z-[90] mx-auto flex w-full max-w-[30rem] flex-col gap-3 px-4"
    >
      <TransitionGroup name="toast-stack" tag="div" class="flex flex-col gap-3">
        <div
          v-for="item in items"
          :key="item.id"
          class="pointer-events-auto rounded-[1rem] border shadow-xl backdrop-blur"
          :class="toneClasses(item)"
        >
          <div class="flex items-start gap-3 p-4">
            <component :is="iconComponent(item)" class="mt-0.5 h-5 w-5 shrink-0" />
            <div class="min-w-0 flex-1 space-y-1">
              <p class="text-sm font-semibold leading-5">{{ item.title }}</p>
              <p v-if="item.description" class="text-sm leading-5 text-current/80">
                {{ item.description }}
              </p>
            </div>
            <button
              type="button"
              class="inline-flex h-8 w-8 items-center justify-center rounded-full text-current/70 transition hover:bg-white/10 hover:text-current"
              @click="toastStore.remove(item.id)"
            >
              <X class="h-4 w-4" />
            </button>
          </div>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-stack-enter-active,
.toast-stack-leave-active {
  transition: all 0.24s ease;
}

.toast-stack-enter-from,
.toast-stack-leave-to {
  opacity: 0;
  transform: translateY(-10px) scale(0.98);
}

.toast-stack-move {
  transition: transform 0.24s ease;
}
</style>
