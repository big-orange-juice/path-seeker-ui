<script setup lang="ts">
import { computed, ref, useSlots } from 'vue';
import { onClickOutside } from '#imports';
import AppIcon from '@/components/ui/AppIcon.vue';
import { cn } from '@/utils/cn';
import type { VNode, VNodeArrayChildren } from 'vue';

defineOptions({ inheritAttrs: false });

interface SelectOption {
  label: string;
  value: string;
  disabled: boolean;
}

interface Props {
  class?: string;
  placeholder?: string;
  disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  class: '',
  placeholder: '请选择',
  disabled: false,
});

const model = defineModel<string>({ default: '' });
const slots = useSlots();
const rootRef = ref<HTMLElement | null>(null);
const open = ref(false);

const extractText = (children: VNode['children']): string => {
  if (typeof children === 'string') {
    return children.trim();
  }

  if (Array.isArray(children)) {
    return children
      .map((child) => {
        if (typeof child === 'string') {
          return child;
        }

        if (typeof child === 'object' && child && 'children' in child) {
          return extractText(child.children as VNode['children']);
        }

        return '';
      })
      .join('')
      .trim();
  }

  return '';
};

const flattenOptions = (nodes: VNodeArrayChildren | undefined): SelectOption[] => {
  if (!nodes) {
    return [];
  }

  const options: SelectOption[] = [];

  for (const node of nodes) {
    if (!node || typeof node === 'string' || typeof node === 'number') {
      continue;
    }

    const vnode = node as VNode;

    if (vnode.type === 'option') {
      const optionProps = (vnode.props ?? {}) as Record<string, unknown>;
      options.push({
        label: extractText(vnode.children),
        value: String(optionProps.value ?? ''),
        disabled: Boolean(optionProps.disabled),
      });
      continue;
    }

    if (Array.isArray(vnode.children)) {
      options.push(...flattenOptions(vnode.children));
    }
  }

  return options;
};

const options = computed(() => flattenOptions(slots.default?.() as VNodeArrayChildren | undefined));
const selectedOption = computed(() => options.value.find((option) => option.value === model.value) ?? null);
const triggerLabel = computed(() => selectedOption.value?.label || props.placeholder);

const toggleOpen = () => {
  if (props.disabled) {
    return;
  }

  open.value = !open.value;
};

const selectOption = (option: SelectOption) => {
  if (option.disabled) {
    return;
  }

  model.value = option.value;
  open.value = false;
};

onClickOutside(rootRef, () => {
  open.value = false;
});
</script>

<template>
  <div ref="rootRef" class="relative w-full">
    <button
      type="button"
      :disabled="props.disabled"
      :class="cn(
        'flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50',
        open && 'ring-2 ring-ring ring-offset-2 ring-offset-background',
        props.class,
      )"
      v-bind="$attrs"
      @click="toggleOpen">
      <span :class="selectedOption ? 'text-foreground' : 'text-muted-foreground'">
        {{ triggerLabel }}
      </span>
      <AppIcon name="arrow-up-down" class="h-4 w-4 shrink-0 text-muted-foreground" />
    </button>

    <div
      v-if="open"
      class="absolute z-50 mt-1 max-h-72 w-full overflow-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md">
      <button
        v-for="option in options"
        :key="`${option.value}:${option.label}`"
        type="button"
        :disabled="option.disabled"
        :class="cn(
          'flex w-full items-center rounded-sm px-2 py-1.5 text-left text-sm outline-none transition-colors',
          option.value === model ? 'bg-accent text-accent-foreground' : 'text-foreground hover:bg-accent hover:text-accent-foreground',
          option.disabled && 'pointer-events-none opacity-50',
        )"
        @click="selectOption(option)">
        {{ option.label }}
      </button>
    </div>
  </div>
</template>

