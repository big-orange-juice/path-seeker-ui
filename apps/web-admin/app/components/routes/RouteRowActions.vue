<script setup lang="ts">
/**
 * 主题路线列表行操作：主操作外露，次要操作收进「更多」。
 * 外露：状态流转（提交审核/上架/下线）+ 详情入口（编辑/查看/审核）
 * 更多：海报、删除
 */
import { computed, ref } from 'vue';
import { onClickOutside } from '#imports';
import Button from '@/components/shadcn/button/Button.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import type { RouteWorkflowActions } from '@/constants/routeWorkflow';
import type { RouteRecord } from '@/types/route';

interface Props {
  record: RouteRecord;
  actions: RouteWorkflowActions;
  acting?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  acting: false,
});

const emit = defineEmits<{
  detail: [];
  poster: [];
  publish: [];
  unpublish: [];
  submitAudit: [];
  refreshRow: [];
  remove: [];
}>();

const menuOpen = ref(false);
const rootRef = ref<HTMLElement | null>(null);

onClickOutside(rootRef, () => {
  menuOpen.value = false;
});

const isGenerating = computed(() => Boolean(props.record.isGenerating));

/** 主状态流转按钮（最多一个） */
const primaryAction = computed(() => {
  const a = props.actions;
  if (a.canSubmitAudit) {
    return { key: 'submitAudit' as const, label: '提交审核', variant: 'default' as const };
  }
  if (a.canPublish) {
    return {
      key: 'publish' as const,
      label: props.record.publishStatus === 3 ? '重新上架' : '上架',
      variant: 'default' as const,
    };
  }
  if (a.canUnpublish) {
    return { key: 'unpublish' as const, label: '下线', variant: 'outline' as const };
  }
  return null;
});

const openLabel = computed(() => props.actions.openLabel);
const canOpenDetail = computed(() => props.actions.canOpenDetail && Boolean(openLabel.value));

const openVariant = computed(() => {
  if (props.actions.canAudit) return 'default' as const;
  if (props.actions.canEditContent) return 'outline' as const;
  return 'ghost' as const;
});

/** 更多菜单项：海报始终；删除按权限 */
const moreItems = computed(() => {
  const items: Array<{
    key: 'poster' | 'remove';
    label: string;
    danger?: boolean;
  }> = [{ key: 'poster', label: '海报' }];
  if (props.actions.canDelete) {
    items.push({ key: 'remove', label: '删除', danger: true });
  }
  return items;
});

const showMore = computed(() => !isGenerating.value && moreItems.value.length > 0);

const runPrimary = () => {
  const action = primaryAction.value;
  if (!action || props.acting) return;
  if (action.key === 'submitAudit') emit('submitAudit');
  else if (action.key === 'publish') emit('publish');
  else if (action.key === 'unpublish') emit('unpublish');
};

const runMore = (key: 'poster' | 'remove') => {
  if (props.acting) return;
  menuOpen.value = false;
  if (key === 'poster') emit('poster');
  else emit('remove');
};

const toggleMenu = () => {
  if (props.acting) return;
  menuOpen.value = !menuOpen.value;
};
</script>

<template>
  <div ref="rootRef" class="flex flex-wrap items-center justify-start gap-1.5">
    <template v-if="isGenerating">
      <Button
        variant="ghost"
        size="sm"
        class="h-7 px-2.5 text-xs"
        :disabled="acting"
        @click="emit('refreshRow')"
      >
        <AppIcon name="refresh-cw" class="h-3.5 w-3.5" :stroke-width="1.8" />
        刷新
      </Button>
      <Button
        v-if="actions.canDelete"
        variant="secondary"
        size="sm"
        class="h-7 px-2.5 text-xs"
        :disabled="acting"
        @click="emit('remove')"
      >
        删除
      </Button>
    </template>

    <template v-else>
      <Button
        v-if="primaryAction"
        :variant="primaryAction.variant"
        size="sm"
        class="h-7 px-2.5 text-xs"
        :disabled="acting"
        @click="runPrimary"
      >
        {{ primaryAction.label }}
      </Button>

      <Button
        v-if="canOpenDetail"
        :variant="openVariant"
        size="sm"
        class="h-7 px-2.5 text-xs"
        :disabled="acting"
        :title="
          actions.canAudit
            ? '打开路线内容只读审阅，底部可提交审核结论'
            : undefined
        "
        @click="emit('detail')"
      >
        {{ openLabel }}
      </Button>

      <div v-if="showMore" class="relative">
        <Button
          variant="ghost"
          size="sm"
          class="h-7 px-2.5 text-xs"
          :disabled="acting"
          title="更多操作"
          aria-haspopup="menu"
          :aria-expanded="menuOpen"
          @click="toggleMenu"
        >
          更多操作
        </Button>

        <div
          v-if="menuOpen"
          class="absolute right-0 z-30 mt-1 min-w-[7.5rem] overflow-hidden rounded-md border border-border/70 bg-[#17191d] py-1 shadow-lg"
          role="menu"
        >
          <button
            v-for="item in moreItems"
            :key="item.key"
            type="button"
            role="menuitem"
            class="flex w-full items-center px-3 py-1.5 text-left text-xs transition-colors hover:bg-accent"
            :class="item.danger ? 'text-destructive hover:text-destructive' : 'text-foreground'"
            :disabled="acting"
            @click="runMore(item.key)"
          >
            {{ item.label }}
          </button>
        </div>
      </div>
    </template>
  </div>
</template>
