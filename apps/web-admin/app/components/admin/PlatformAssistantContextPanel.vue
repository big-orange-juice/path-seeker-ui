<script setup lang="ts">
import { computed } from 'vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import Button from '@/components/ui/Button.vue';
import type {
  PlatformAssistantContextDrop,
  PlatformAssistantContextResponse,
  PlatformAssistantToolCatalogResponse,
} from '@/types/platform-assistant';
import type {
  PlatformAssistantContextEntry,
  PlatformAssistantContextSyncStatus,
} from '@/composables/usePlatformAssistant';
import { resolveContextFieldLabel } from '@/utils/platform-assistant';

/**
 * 平台助手「页面上下文 / 工具白名单」侧栏卡片。
 *
 * 展示口径（设计文档 §8）：
 * - 上方列出**前端提交的候选值**，并明确标注"前端传入的上下文不视为已授权"；
 * - 下方只展示**后端核验后保留的对象**与 **dropped（被裁剪字段 + 原因）**，原因文案由后端下发。
 */
interface Props {
  submittedEntries: PlatformAssistantContextEntry[];
  verifiedEntries: PlatformAssistantContextEntry[];
  verified: PlatformAssistantContextResponse | null;
  drops: PlatformAssistantContextDrop[];
  syncStatus: PlatformAssistantContextSyncStatus;
  syncError: string;
  verifiedAt: string;
  submittedAt: string;
  hasSession: boolean;
  catalog: PlatformAssistantToolCatalogResponse | null;
  catalogLoading: boolean;
  catalogError: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  refresh: [];
  clearSelection: [];
  loadTools: [];
}>();

const syncStatusLabel = computed(() => {
  switch (props.syncStatus) {
    case 'syncing':
      return '正在提交核验…';
    case 'verified':
      return '已核验';
    case 'failed':
      return '核验失败';
    default:
      return props.hasSession ? '尚未提交' : '未创建会话';
  }
});

const tools = computed(() => props.catalog?.tools ?? []);

const catalogSummary = computed(() => {
  const catalog = props.catalog;

  if (!catalog) {
    return '';
  }

  const source = catalog.allowedToolsFromConfig
    ? '白名单来自后端配置'
    : '白名单为后端内置只读默认值';

  return `${source} · 共 ${catalog.tools.length} 个工具`;
});

const writePolicyLabel = computed(() => {
  const catalog = props.catalog;

  if (!catalog) {
    return '';
  }

  if (!catalog.writeToolsEnabled) {
    return '当前未启用写入类工具：助手只能查询与解释，不会修改平台数据。';
  }

  return catalog.requireWriteConfirmation
    ? '已启用写入类工具：每次写入都需要你在抽屉里逐次确认后才会执行。'
    : '已启用写入类工具，且后端未要求逐次确认（PlatformAssistant:RequireWriteConfirmation=false）。';
});
</script>

<template>
  <section class="pa-card">
    <header class="pa-card__head">
      <h3 class="pa-card__title">页面上下文</h3>
      <span class="pa-chip" :class="{ 'is-ok': props.syncStatus === 'verified', 'is-warn': props.syncStatus === 'failed' }">
        {{ syncStatusLabel }}
      </span>
    </header>

    <p class="pa-note">
      以显式字段提交（当前路由 / 场馆 / 典藏 / 路线 / 节点 / 解说导游）。
      <b>前端传入的上下文一律不视为已授权</b>，后端会用数据权限服务重新核验后再裁剪；
      下面只展示后端返回的核验结果与裁剪原因。
    </p>

    <p v-if="props.syncStatus === 'verified'" class="pa-note pa-note--ok">
      提交于 {{ props.submittedAt || '—' }} · 后端核验时间 {{ props.verifiedAt || '—' }}
    </p>
    <p v-else-if="props.syncStatus === 'failed'" class="pa-note pa-note--error">
      {{ props.syncError || '页面上下文提交失败。' }}
    </p>
    <p v-else-if="!props.hasSession" class="pa-note">
      还没有平台助手会话：发送第一条消息时会创建独立会话（scene=platform，与页面内 Chat 隔离），
      并在发送前自动提交一次页面上下文。
    </p>

    <div class="pa-block">
      <p class="pa-block__title">前端提交的候选值（未授权）</p>
      <p v-if="!props.submittedEntries.length" class="pa-empty">当前页面没有可提交的选中对象。</p>
      <ul v-else class="pa-list">
        <li v-for="entry in props.submittedEntries" :key="entry.key" class="pa-row">
          <span class="pa-row__label">{{ entry.label }}</span>
          <span class="pa-row__value">{{ entry.value }}</span>
        </li>
      </ul>
    </div>

    <div class="pa-block">
      <p class="pa-block__title">后端核验后保留</p>
      <p v-if="!props.verified" class="pa-empty">尚无核验结果。</p>
      <p v-else-if="!props.verifiedEntries.length" class="pa-empty">后端未保留任何上下文对象。</p>
      <ul v-else class="pa-list">
        <li v-for="entry in props.verifiedEntries" :key="entry.key" class="pa-row">
          <span class="pa-row__label">{{ entry.label }}</span>
          <span class="pa-row__value">{{ entry.value }}</span>
        </li>
      </ul>
    </div>

    <div v-if="props.drops.length" class="pa-block">
      <p class="pa-block__title pa-block__title--warn">被裁剪的字段（{{ props.drops.length }}）</p>
      <ul class="pa-list">
        <li v-for="drop in props.drops" :key="`${drop.field}-${drop.providedValue ?? ''}`" class="pa-drop">
          <p class="pa-drop__head">
            <b>{{ resolveContextFieldLabel(drop.field) }}</b>
            <span class="pa-drop__value">{{ drop.providedValue || '（空值）' }}</span>
          </p>
          <p class="pa-drop__reason">{{ drop.reason }}</p>
        </li>
      </ul>
    </div>

    <div class="pa-actions">
      <Button
        variant="outline"
        size="sm"
        class="pa-btn"
        :disabled="!props.hasSession || props.syncStatus === 'syncing'"
        @click="emit('refresh')">
        <AppIcon name="refresh-cw" class="mr-1 h-3 w-3" />
        重新核验
      </Button>
      <Button
        variant="ghost"
        size="sm"
        class="pa-btn"
        :disabled="!props.submittedEntries.length"
        @click="emit('clearSelection')">
        清空选中
      </Button>
    </div>
  </section>

  <section class="pa-card">
    <header class="pa-card__head">
      <h3 class="pa-card__title">工具白名单</h3>
      <span v-if="props.catalog" class="pa-chip" :class="{ 'is-warn': !props.catalog.enabled }">
        {{ props.catalog.enabled ? '已启用' : '未启用' }}
      </span>
    </header>

    <p v-if="props.catalogError" class="pa-note pa-note--error">{{ props.catalogError }}</p>
    <p v-else-if="props.catalogLoading" class="pa-empty">正在读取工具白名单…</p>
    <template v-else-if="props.catalog">
      <p class="pa-note">{{ catalogSummary }}</p>
      <p class="pa-note">{{ writePolicyLabel }}</p>
      <ul class="pa-list">
        <li v-for="tool in tools" :key="tool.name" class="pa-tool">
          <p class="pa-tool__head">
            <code class="pa-tool__name">{{ tool.name }}</code>
            <span class="pa-tag" :class="{ 'is-write': tool.isWriteTool }">
              {{ tool.isWriteTool ? (tool.requiresConfirmation ? '写入 · 需逐次确认' : '写入') : '只读' }}
            </span>
          </p>
          <p v-if="tool.description" class="pa-tool__desc">{{ tool.description }}</p>
        </li>
      </ul>
    </template>
    <p v-else class="pa-empty">尚未读取工具白名单。</p>

    <div class="pa-actions">
      <Button
        variant="outline"
        size="sm"
        class="pa-btn"
        :disabled="props.catalogLoading"
        @click="emit('loadTools')">
        <AppIcon name="refresh-cw" class="mr-1 h-3 w-3" />
        重新读取
      </Button>
    </div>
  </section>
</template>

<style scoped>
.pa-card {
  border-radius: 0.75rem;
  border: 1px solid rgba(209, 178, 111, 0.14);
  background: rgba(255, 255, 255, 0.02);
  padding: 0.7rem;
}

.pa-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.45rem;
}

.pa-card__title {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(209, 178, 111, 0.72);
}

.pa-chip {
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  padding: 0.05rem 0.45rem;
  font-size: 10px;
  color: rgba(168, 170, 176, 0.9);
  white-space: nowrap;
}

.pa-chip.is-ok {
  border-color: rgba(52, 211, 153, 0.35);
  color: rgb(110, 231, 183);
}

.pa-chip.is-warn {
  border-color: rgba(251, 191, 36, 0.35);
  color: rgb(252, 211, 77);
}

.pa-note {
  margin-bottom: 0.4rem;
  font-size: 11px;
  line-height: 1.6;
  color: rgba(168, 170, 176, 0.9);
}

.pa-note b {
  color: rgba(232, 205, 138, 0.95);
  font-weight: 600;
}

.pa-note--ok {
  color: rgb(110, 231, 183);
}

.pa-note--error {
  color: rgb(248, 113, 113);
}

.pa-block {
  margin-top: 0.5rem;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  padding-top: 0.45rem;
}

.pa-block__title {
  margin-bottom: 0.3rem;
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(168, 170, 176, 0.75);
}

.pa-block__title--warn {
  color: rgb(252, 211, 77);
}

.pa-list {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.pa-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
  font-size: 11px;
}

.pa-row__label {
  flex-shrink: 0;
  color: rgba(168, 170, 176, 0.85);
}

.pa-row__value {
  min-width: 0;
  text-align: right;
  word-break: break-all;
}

.pa-drop {
  border-radius: 0.5rem;
  border: 1px solid rgba(251, 191, 36, 0.22);
  background: rgba(251, 191, 36, 0.06);
  padding: 0.35rem 0.45rem;
  font-size: 11px;
  line-height: 1.55;
}

.pa-drop__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.4rem;
}

.pa-drop__value {
  word-break: break-all;
  color: rgba(252, 211, 77, 0.9);
}

.pa-drop__reason {
  margin-top: 0.15rem;
  color: rgba(214, 211, 209, 0.9);
}

.pa-tool {
  border-radius: 0.5rem;
  border: 1px solid rgba(255, 255, 255, 0.06);
  padding: 0.3rem 0.4rem;
}

.pa-tool__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.4rem;
}

.pa-tool__name {
  font-size: 11px;
  color: rgba(232, 205, 138, 0.92);
}

.pa-tool__desc {
  margin-top: 0.15rem;
  font-size: 10px;
  line-height: 1.5;
  color: rgba(168, 170, 176, 0.8);
}

.pa-tag {
  flex-shrink: 0;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  padding: 0.02rem 0.4rem;
  font-size: 10px;
  color: rgba(168, 170, 176, 0.9);
}

.pa-tag.is-write {
  border-color: rgba(251, 191, 36, 0.35);
  color: rgb(252, 211, 77);
}

.pa-empty {
  font-size: 11px;
  line-height: 1.6;
  color: rgba(168, 170, 176, 0.72);
}

.pa-actions {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  margin-top: 0.5rem;
}

.pa-btn {
  height: 1.75rem;
  font-size: 11px;
}
</style>
