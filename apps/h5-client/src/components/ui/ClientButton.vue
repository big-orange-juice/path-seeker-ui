<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { Button, buttonVariants, cn } from "@path-seeker/ui"

type ClientButtonVariant = "default" | "secondary" | "ghost" | "outline"
type ClientButtonSize = "default" | "sm" | "lg" | "icon"

interface Props {
  variant?: ClientButtonVariant
  size?: ClientButtonSize
  type?: "button" | "submit" | "reset"
  disabled?: boolean
  class?: HTMLAttributes["class"]
}

const props = withDefaults(defineProps<Props>(), {
  variant: "default",
  size: "default",
  type: "button",
  disabled: false,
  class: undefined,
})
</script>

<template>
  <Button
    :type="props.type"
    :disabled="props.disabled"
    :variant="props.variant"
    :size="props.size"
    :class="
      cn(
        buttonVariants({ variant: props.variant, size: props.size }),
        props.variant === 'default' && 'shadow-[0_10px_22px_rgba(209,178,111,0.22)] hover:bg-primary/92',
        props.size === 'default' && 'h-10',
        props.size === 'lg' && 'h-11 px-6 text-sm',
        props.size === 'icon' && 'h-10 w-10 p-0',
        props.class,
      )
    "
  >
    <slot />
  </Button>
</template>
