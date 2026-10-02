<script setup lang="ts">
import { computed, shallowRef } from 'vue';
import Button from '@/components/shadcn/button/Button.vue';
import Input from '@/components/shadcn/input/Input.vue';
import type { CulturalPlaceRecord } from '@/types/cultural-place';

const props = defineProps<{ places: CulturalPlaceRecord[]; disabled: boolean }>();
const model = defineModel<string[]>({ required: true });
const keyword = shallowRef('');
const available = computed(() => props.places.filter(item => item.status === 1 && !model.value.includes(item.id) && `${item.name} ${item.category || ''}`.includes(keyword.value.trim())));
const selected = computed(() => model.value.map(id => props.places.find(item => item.id === id)).filter((item): item is CulturalPlaceRecord => Boolean(item)));

function move(index: number, delta: number) {
  const next = [...model.value];
  const target = index + delta;
  if (target < 0 || target >= next.length) return;
  [next[index], next[target]] = [next[target]!, next[index]!];
  model.value = next;
}
</script>

<template>
  <div class="grid min-h-0 gap-4 md:grid-cols-2">
    <section class="space-y-2"><h3 class="text-sm font-medium">可选文化点</h3><Input v-model="keyword" placeholder="搜索文化点" /><ul class="max-h-[36vh] space-y-2 overflow-auto"><li v-for="place in available" :key="place.id" class="flex items-center justify-between gap-2 rounded-md border p-2 text-sm"><span>{{ place.name }}<small class="ml-2 text-muted-foreground">{{ place.category }}</small></span><Button type="button" size="sm" variant="outline" :disabled="disabled || place.longitude == null || place.latitude == null" @click="model = [...model, place.id]">添加</Button></li></ul></section>
    <section class="space-y-2"><h3 class="text-sm font-medium">停靠顺序（{{ selected.length }}）</h3><ol class="max-h-[41vh] space-y-2 overflow-auto"><li v-for="(place, index) in selected" :key="place.id" class="flex items-center justify-between gap-2 rounded-md border p-2 text-sm"><span>{{ index + 1 }}. {{ place.name }}</span><div class="flex gap-1"><Button type="button" size="sm" variant="ghost" :disabled="disabled || index === 0" @click="move(index, -1)">上移</Button><Button type="button" size="sm" variant="ghost" :disabled="disabled || index === selected.length - 1" @click="move(index, 1)">下移</Button><Button type="button" size="sm" variant="ghost" :disabled="disabled" @click="model = model.filter(id => id !== place.id)">移除</Button></div></li></ol><p v-if="!selected.length" class="py-6 text-sm text-muted-foreground">选择至少两个文化点，按游览顺序排列。</p></section>
  </div>
</template>
