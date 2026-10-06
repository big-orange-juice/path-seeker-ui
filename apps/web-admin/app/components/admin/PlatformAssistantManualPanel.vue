<script setup lang="ts">
import { computed } from 'vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import Button from '@/components/ui/Button.vue';
import Input from '@/components/ui/Input.vue';
import Textarea from '@/components/shadcn/textarea/Textarea.vue';
import type {
  PlatformAssistantManualAnswerResponse,
  PlatformAssistantManualHit,
  PlatformAssistantManualSearchResponse,
  PlatformAssistantManualStatusResponse,
} from '@/types/platform-assistant';
import { PLATFORM_ASSISTANT_ERROR_CODES, formatAssistantTime, formatDurationMs } from '@/utils/platform-assistant';

/**
 * 平台助手「操作手册」面板：索引状态 / 强制重建 / 章节检索 / 问答（含出处）。
 *
 * 对接后端：
 * - GET  /api/PlatformAssistant/manual/status（未配置或文件缺失时 Configured/FileExists=false，不抛异常）
 * - POST /api/PlatformAssistant/manual/reindex
 * - GET  /api/PlatformAssistant/manual/search（章节 + 页码区间）
 * - POST /api/PlatformAssistant/manual/ask（答案 + 出处）
 *
 * 手册未配置（19002）/ 索引不可用（19003）时给出明确文案，不笼统报错。
 */
interface Props {
  status: PlatformAssistantManualStatusResponse | null;
  statusLoading: boolean;
  statusLoaded: boolean;
  statusError: string;
  /** 手册索引是否可用于检索/问答 */
  manualReady: boolean;
  /** 不可用的明确原因（未配置 / 文件缺失 / 构建失败） */
  unavailableReason: string;
  reindexing: boolean;
  reindexNotice: string;
  reindexError: string;
  searchLoading: boolean;
  searchError: string;
  searchErrorCode: number | null;
  searchResult: PlatformAssistantManualSearchResponse | null;
  askLoading: boolean;
  askError: string;
  askErrorCode: number | null;
  answer: PlatformAssistantManualAnswerResponse | null;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  reindex: [];
  refreshStatus: [];
  search: [];
  ask: [];
  clearSearch: [];
  clearAnswer: [];
}>();

const keyword = defineModel<string>('keyword', { default: '' });
const question = defineModel<string>('question', { default: '' });

const hits = computed<PlatformAssistantManualHit[]>(() => props.searchResult?.hits ?? []);
const citations = computed<PlatformAssistantManualHit[]>(() => props.answer?.citations ?? []);

const versionLabel = computed(() => String(props.status?.version ?? '').trim() || '—');
const builtAtLabel = computed(() => formatAssistantTime(props.status?.builtAt) || '—');
const buildDurationLabel = computed(() => formatDurationMs(props.status?.buildDurationMs) || '—');
const lastErrorAtLabel = computed(() => formatAssistantTime(props.status?.lastErrorAt));

const indexStateLabel = computed(() => {
  if (!props.statusLoaded) {
    return '未读取';
  }

  if (!props.status) {
    return '未知';
  }

  return props.manualReady ? '可用' : '不可用';
});

const isIndexUnavailableCode = (code: number | null): boolean =>
  code === PLATFORM_ASSISTANT_ERROR_CODES.manualIndexUnavailable
  || code === PLATFORM_ASSISTANT_ERROR_CODES.manualNotConfigured;

const pageRange = (hit: PlatformAssistantManualHit): string => {
  const start = Number.isFinite(hit.pageStart) ? hit.pageStart : 0;
  const end = Number.isFinite(hit.pageEnd) ? hit.pageEnd : start;

  if (start <= 0) {
    return '页码未标注';
  }

  return end > start ? `第 ${start}-${end} 页` : `第 ${start} 页`;
};

const scoreLabel = (hit: PlatformAssistantManualHit): string =>
  Number.isFinite(hit.score) && hit.score > 0 ? hit.score.toFixed(2) : '—';

const submitSearch = () => {
  if (props.searchLoading) {
    return;
  }

  emit('search');
};

const submitAsk = () => {
  if (props.askLoading) {
    return;
  }

  emit('ask');
};
</script>

<template>
  <section class="pa-card">
    <header class="pa-card__head">
      <h3 class="pa-card__title">操作手册索引</h3>
      <span class="pa-chip" :class="{ 'is-ok': props.manualReady, 'is-warn': props.statusLoaded && !props.manualReady }">
        {{ indexStateLabel }}
      </span>
    </header>

    <p class="pa-note">
      手册是后端本地 PDF（PlatformAssistant:Manual:Path），更新为线下操作；
      索引按文件哈希异步重建，失败时保留上一可用版本。
    </p>

    <p v-if="props.statusError" class="pa-note pa-note--error">{{ props.statusError }}</p>
    <p v-else-if="props.statusLoading && !props.statusLoaded" class="pa-empty">正在读取索引状态…</p>

    <ul v-if="props.status" class="pa-list">
      <li class="pa-row">
        <span class="pa-row__label">索引版本</span>
        <span class="pa-row__value">{{ versionLabel }}</span>
      </li>
      <li class="pa-row">
        <span class="pa-row__label">页数 / 章节数</span>
        <span class="pa-row__value">{{ props.status.pageCount }} 页 / {{ props.status.chapterCount }} 章</span>
      </li>
      <li class="pa-row">
        <span class="pa-row__label">最后构建时间</span>
        <span class="pa-row__value">{{ builtAtLabel }}</span>
      </li>
      <li class="pa-row">
        <span class="pa-row__label">最近构建耗时</span>
        <span class="pa-row__value">{{ buildDurationLabel }}</span>
      </li>
      <li class="pa-row">
        <span class="pa-row__label">手册文件</span>
        <span class="pa-row__value">{{ props.status.filePath || '（未配置路径）' }}</span>
      </li>
      <li class="pa-row">
        <span class="pa-row__label">文件是否存在</span>
        <span class="pa-row__value">{{ props.status.fileExists ? '存在' : '不存在' }}</span>
      </li>
      <li v-if="props.status.cachePath" class="pa-row">
        <span class="pa-row__label">索引缓存</span>
        <span class="pa-row__value">{{ props.status.cachePath }}</span>
      </li>
    </ul>
    <p v-else-if="!props.statusLoading && !props.statusError" class="pa-empty">尚未读取索引状态。</p>

    <p v-if="props.unavailableReason" class="pa-note pa-note--warn">{{ props.unavailableReason }}</p>
    <p v-if="props.status?.lastError" class="pa-note pa-note--error">
      最近一次失败：{{ props.status.lastError }}<span v-if="lastErrorAtLabel">（{{ lastErrorAtLabel }}）</span>
    </p>

    <p v-if="props.reindexNotice" class="pa-note pa-note--ok">{{ props.reindexNotice }}</p>
    <p v-if="props.reindexError" class="pa-note pa-note--error">{{ props.reindexError }}</p>

    <div class="pa-actions">
      <Button
        variant="outline"
        size="sm"
        class="pa-btn"
        :disabled="props.statusLoading"
        @click="emit('refreshStatus')">
        <AppIcon name="refresh-cw" class="mr-1 h-3 w-3" />
        刷新状态
      </Button>
      <Button
        variant="outline"
        size="sm"
        class="pa-btn"
        :disabled="props.reindexing"
        @click="emit('reindex')">
        <AppIcon name="refresh-cw" class="mr-1 h-3 w-3" />
        {{ props.reindexing ? '重建中…' : '重建索引' }}
      </Button>
    </div>
  </section>

  <section class="pa-card">
    <header class="pa-card__head">
      <h3 class="pa-card__title">手册章节检索</h3>
      <span v-if="props.searchResult" class="pa-chip">{{ hits.length }} 条命中</span>
    </header>

    <div class="pa-field">
      <Input
        v-model="keyword"
        class="pa-input"
        placeholder="手册里的功能名或字段名，例如：范围配置"
        :disabled="props.searchLoading"
        @keyup.enter="submitSearch" />
      <Button
        variant="outline"
        size="sm"
        class="pa-btn"
        :disabled="props.searchLoading || !keyword.trim()"
        @click="submitSearch">
        检索
      </Button>
    </div>

    <p v-if="props.searchError" class="pa-note pa-note--error">
      {{ props.searchError }}
      <span v-if="isIndexUnavailableCode(props.searchErrorCode)" class="pa-note__hint">
        可先点击上方“重建索引”后重试。
      </span>
    </p>
    <p v-else-if="props.searchLoading" class="pa-empty">正在检索手册章节…</p>
    <p
      v-else-if="props.searchResult && !hits.length"
      class="pa-empty">
      未检索到「{{ props.searchResult.query }}」相关章节；换用手册中出现的关键词再试。
    </p>
    <p v-else-if="!props.searchResult" class="pa-empty">输入关键词检索手册章节，命中会给出章节标题与页码区间。</p>

    <ul v-if="hits.length" class="pa-list">
      <li v-for="(hit, index) in hits" :key="`${hit.chapterIndex}-${hit.pageStart}-${index}`" class="pa-hit">
        <p class="pa-hit__head">
          <b>{{ hit.chapterTitle || '未命名章节' }}</b>
          <span class="pa-hit__meta">{{ pageRange(hit) }} · 相关度 {{ scoreLabel(hit) }}</span>
        </p>
        <p v-if="hit.excerpt" class="pa-hit__excerpt">{{ hit.excerpt }}</p>
      </li>
    </ul>

    <div v-if="props.searchResult" class="pa-actions">
      <Button variant="ghost" size="sm" class="pa-btn" @click="emit('clearSearch')">清空检索结果</Button>
    </div>
  </section>

  <section class="pa-card">
    <header class="pa-card__head">
      <h3 class="pa-card__title">手册问答（含出处）</h3>
      <span v-if="props.answer?.noManualMatch" class="pa-chip is-warn">未命中手册</span>
    </header>

    <Textarea
      v-model="question"
      class="pa-textarea"
      placeholder="用中文问平台操作问题，例如：景点范围怎么配置？"
      :disabled="props.askLoading" />

    <div class="pa-actions">
      <Button
        variant="default"
        size="sm"
        class="pa-btn"
        :disabled="props.askLoading || !question.trim()"
        @click="submitAsk">
        <AppIcon name="circle-help" class="mr-1 h-3 w-3" />
        {{ props.askLoading ? '提问中…' : '问手册' }}
      </Button>
      <Button
        v-if="props.answer"
        variant="ghost"
        size="sm"
        class="pa-btn"
        @click="emit('clearAnswer')">
        清空答案
      </Button>
    </div>

    <p class="pa-note">
      手册问答严格依据后端召回的章节片段作答，答案与出处（章节 + 页码）由 /api/PlatformAssistant/manual/ask 返回；
      手册未覆盖的内容后端会明确说明"手册中未提及"。
    </p>

    <p v-if="props.askError" class="pa-note pa-note--error">
      {{ props.askError }}
      <span v-if="isIndexUnavailableCode(props.askErrorCode)" class="pa-note__hint">
        可先点击上方“重建索引”后重试。
      </span>
    </p>
    <p v-else-if="props.askLoading" class="pa-empty">正在依据手册生成答案…</p>

    <template v-else-if="props.answer">
      <p v-if="props.answer.noManualMatch" class="pa-note pa-note--warn">
        手册中没有检索到与该问题相关的章节，下面的答案不基于手册，仅供参考。
      </p>
      <p class="pa-answer">{{ props.answer.answer }}</p>

      <div class="pa-block">
        <p class="pa-block__title">出处（章节 + 页码）</p>
        <p v-if="!citations.length" class="pa-empty">本次没有可展示的出处。</p>
        <ul v-else class="pa-list">
          <li v-for="(hit, index) in citations" :key="`${hit.chapterIndex}-${hit.pageStart}-${index}`" class="pa-hit">
            <p class="pa-hit__head">
              <b>{{ hit.chapterTitle || '未命名章节' }}</b>
              <span class="pa-hit__meta">{{ pageRange(hit) }}</span>
            </p>
            <p v-if="hit.excerpt" class="pa-hit__excerpt">{{ hit.excerpt }}</p>
          </li>
        </ul>
      </div>

      <p class="pa-meta">
        <span v-if="props.answer.version">手册版本 {{ props.answer.version }}</span>
        <span v-if="props.answer.model"> · 模型 {{ props.answer.model }}</span>
        <span v-if="props.answer.provider"> · 渠道 {{ props.answer.provider }}</span>
        <span v-if="props.answer.durationMs"> · 耗时 {{ formatDurationMs(props.answer.durationMs) }}</span>
      </p>
    </template>
    <p v-else-if="!props.askError" class="pa-empty">提问后会显示答案，并列出引用的章节与页码。</p>
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
  margin: 0.4rem 0;
  font-size: 11px;
  line-height: 1.6;
  color: rgba(168, 170, 176, 0.9);
}

.pa-note--ok {
  color: rgb(110, 231, 183);
}

.pa-note--warn {
  color: rgb(252, 211, 77);
}

.pa-note--error {
  color: rgb(248, 113, 113);
}

.pa-note__hint {
  color: rgba(252, 211, 77, 0.95);
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

.pa-field {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.pa-input {
  height: 1.9rem;
  font-size: 11px;
}

.pa-textarea {
  min-height: 64px;
  font-size: 11px;
}

.pa-hit {
  border-radius: 0.5rem;
  border: 1px solid rgba(255, 255, 255, 0.07);
  padding: 0.35rem 0.45rem;
  font-size: 11px;
  line-height: 1.55;
}

.pa-hit__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.4rem;
}

.pa-hit__meta {
  flex-shrink: 0;
  font-size: 10px;
  color: rgba(209, 178, 111, 0.9);
}

.pa-hit__excerpt {
  margin-top: 0.15rem;
  color: rgba(168, 170, 176, 0.88);
  white-space: pre-wrap;
}

.pa-answer {
  margin: 0.35rem 0;
  border-radius: 0.55rem;
  border: 1px solid rgba(209, 178, 111, 0.16);
  background: rgba(209, 178, 111, 0.05);
  padding: 0.45rem 0.5rem;
  font-size: 11px;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
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

.pa-meta {
  margin-top: 0.35rem;
  font-size: 10px;
  color: rgba(168, 170, 176, 0.72);
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
  margin-top: 0.45rem;
}

.pa-btn {
  height: 1.75rem;
  font-size: 11px;
}
</style>
