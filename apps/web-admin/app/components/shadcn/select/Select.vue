<script setup lang="ts">
import { computed, nextTick, ref, useSlots, useTemplateRef, watch } from 'vue';
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
  /** 下拉内嵌搜索框，按 label / value 过滤 */
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyText?: string;
}

const props = withDefaults(defineProps<Props>(), {
  class: '',
  placeholder: '请选择',
  disabled: false,
  searchable: false,
  searchPlaceholder: '搜索…',
  emptyText: '无匹配项',
});

const emit = defineEmits<{
  /** 搜索关键词变化（可用于远端检索） */
  search: [keyword: string];
}>();

const model = defineModel<string>({ default: '' });
const slots = useSlots();
const rootRef = ref<HTMLElement | null>(null);
const searchInputRef = useTemplateRef<HTMLInputElement>('searchInput');
const open = ref(false);
const searchKeyword = ref('');

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

const filteredOptions = computed(() => {
  if (!props.searchable) {
    return options.value;
  }

  const keyword = searchKeyword.value.trim().toLowerCase();
  if (!keyword) {
    return options.value;
  }

  return options.value.filter((option) => {
    const label = option.label.toLowerCase();
    const value = option.value.toLowerCase();
    return label.includes(keyword) || value.includes(keyword);
  });
});

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
  searchKeyword.value = '';
};

watch(open, (isOpen) => {
  if (!isOpen) {
    searchKeyword.value = '';
    return;
  }

  if (props.searchable) {
    void nextTick(() => {
      searchInputRef.value?.focus();
    });
  }
});

watch(searchKeyword, (keyword) => {
  if (!props.searchable) {
    return;
  }
  emit('search', keyword.trim());
});

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
        'flex h-9 w-full min-w-0 items-center justify-between overflow-hidden rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50',
        open && 'ring-2 ring-ring ring-offset-2 ring-offset-background',
        props.class,
      )"
      :title="triggerLabel"
      v-bind="$attrs"
      @click="toggleOpen">
      <span :class="cn('min-w-0 flex-1 truncate text-left', selectedOption ? 'text-foreground' : 'text-muted-foreground')">
        {{ triggerLabel }}
      </span>
      <AppIcon name="arrow-up-down" class="h-4 w-4 shrink-0 text-muted-foreground" />
    </button>

    <div
      v-if="open"
      class="absolute left-0 z-50 mt-1 w-max min-w-full max-w-[min(520px,calc(100vw-2rem))] overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-md">
      <div
        v-if="props.searchable"
        class="border-b border-border/70 p-1.5"
        @click.stop>
        <input
          ref="searchInput"
          v-model="searchKeyword"
          type="search"
          :placeholder="props.searchPlaceholder"
          class="flex h-8 w-full rounded-md border border-input bg-background px-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring"
          @keydown.esc.stop.prevent="open = false">
      </div>

      <div class="max-h-60 overflow-auto p-1">
        <p
          v-if="!filteredOptions.length"
          class="px-2 py-2 text-center text-xs text-muted-foreground">
          {{ props.emptyText }}
        </p>
        <button
          v-for="option in filteredOptions"
          :key="`${option.value}:${option.label}`"
          type="button"
          :title="option.label"
          :disabled="option.disabled"
          :class="cn(
            'flex w-full min-w-0 items-center rounded-sm px-2 py-1.5 text-left text-sm outline-none transition-colors',
            option.value === model ? 'bg-accent text-accent-foreground' : 'text-foreground hover:bg-accent hover:text-accent-foreground',
            option.disabled && 'pointer-events-none opacity-50',
          )"
          @click="selectOption(option)">
          <span class="block min-w-0 max-w-full truncate whitespace-nowrap">{{ option.label }}</span>
        </button>
      </div>
    </div>
  </div>
</template>
