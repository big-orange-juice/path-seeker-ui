<script setup lang="ts">
/**
 * Studio 统一字段：label + 控件，避免预览编辑时不知道改的是什么。
 */
withDefaults(
  defineProps<{
    label: string
    type?: "text" | "textarea" | "number"
    modelValue?: string | number | null
    placeholder?: string
    rows?: number
    min?: number
    max?: number
    step?: number | string
  }>(),
  {
    type: "text",
    modelValue: "",
    placeholder: "",
    rows: 2,
    min: undefined,
    max: undefined,
    step: undefined,
  },
)

const emit = defineEmits<{
  "update:modelValue": [value: string | number]
  change: []
}>()

function onInput(event: Event) {
  const target = event.target as HTMLInputElement | HTMLTextAreaElement
  emit("update:modelValue", target.value)
}

function onNumberInput(event: Event) {
  const target = event.target as HTMLInputElement
  const raw = target.value
  if (raw === "" || raw === "-") {
    emit("update:modelValue", raw)
    return
  }
  const num = Number(raw)
  emit("update:modelValue", Number.isFinite(num) ? num : raw)
}

function onChange() {
  emit("change")
}
</script>

<template>
  <label class="sf">
    <span class="sf__label">{{ label }}</span>
    <textarea
      v-if="type === 'textarea'"
      class="sf__control"
      :rows="rows"
      :value="modelValue ?? ''"
      :placeholder="placeholder"
      @input="onInput"
      @change="onChange" />
    <input
      v-else-if="type === 'number'"
      class="sf__control"
      type="number"
      :min="min"
      :max="max"
      :step="step"
      :value="modelValue ?? ''"
      :placeholder="placeholder"
      @input="onNumberInput"
      @change="onChange" />
    <input
      v-else
      class="sf__control"
      type="text"
      :value="modelValue ?? ''"
      :placeholder="placeholder"
      @input="onInput"
      @change="onChange" />
  </label>
</template>

<style scoped>
.sf {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 4px;
}

.sf__label {
  color: rgb(209 178 111 / 78%);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
}

.sf__control {
  width: 100%;
  border: 1px solid rgb(255 255 255 / 10%);
  border-radius: 7px;
  background: rgb(0 0 0 / 20%);
  padding: 6px 8px;
  color: #fff8ea;
  font: inherit;
  font-size: 13px;
  line-height: 1.45;
  outline: none;
}

textarea.sf__control {
  resize: vertical;
  min-height: 2.75rem;
}

.sf__control:focus {
  border-color: rgb(209 178 111 / 42%);
}

.sf__control::placeholder {
  color: rgb(247 239 221 / 32%);
}
</style>
