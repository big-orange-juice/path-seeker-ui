<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { cn, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@path-seeker/ui"
import type { SelectOption } from "@path-seeker/ui"

interface Props {
  options: SelectOption[]
  placeholder?: string
  disabled?: boolean
  class?: HTMLAttributes["class"]
}

defineOptions({ inheritAttrs: false })

const model = defineModel<string>({ default: "" })

const props = withDefaults(defineProps<Props>(), {
  placeholder: "请选择",
  disabled: false,
  class: undefined,
})
</script>

<template>
  <Select
    :model-value="model"
    :disabled="props.disabled"
    v-bind="$attrs"
    @update:model-value="(value) => (model = String(value ?? ''))"
  >
    <SelectTrigger
      :class="
        cn(
          'h-10 bg-background px-3 py-2 text-foreground focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background',
          props.class,
        )
      "
    >
      <SelectValue :placeholder="props.placeholder" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem
        v-for="option in props.options"
        :key="option.value"
        :value="option.value"
        :disabled="option.disabled"
      >
        {{ option.label }}
      </SelectItem>
    </SelectContent>
  </Select>
</template>
