<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { Badge, cn } from "@path-seeker/ui"

type ClientBadgeVariant = "highlight" | "success" | "muted"

interface Props {
  variant?: ClientBadgeVariant
  class?: HTMLAttributes["class"]
}

const props = withDefaults(defineProps<Props>(), {
  variant: "highlight",
  class: undefined,
})
</script>

<template>
  <Badge
    :variant="props.variant === 'highlight' ? 'default' : props.variant === 'muted' ? 'secondary' : 'outline'"
    :class="
      cn(
        'inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-medium',
        props.variant === 'highlight' && 'border-transparent bg-primary/14 text-primary hover:bg-primary/18',
        props.variant === 'success' && 'border-transparent bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/14',
        props.variant === 'muted' && 'border-transparent bg-muted text-muted-foreground hover:bg-muted',
        props.class,
      )
    "
  >
    <span class="h-1.5 w-1.5 rounded-full bg-current" />
    <slot />
  </Badge>
</template>
