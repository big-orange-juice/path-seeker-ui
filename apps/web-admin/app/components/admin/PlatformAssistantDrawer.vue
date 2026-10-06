<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import ChatPanel from '@/components/chat/ChatPanel.vue';
import PlatformAssistantConfirmDialog from '@/components/admin/PlatformAssistantConfirmDialog.vue';
import PlatformAssistantContextPanel from '@/components/admin/PlatformAssistantContextPanel.vue';
import PlatformAssistantManualPanel from '@/components/admin/PlatformAssistantManualPanel.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import { usePlatformAssistant } from '@/composables/usePlatformAssistant';
import type { PlatformAssistantContext } from '@/composables/usePlatformAssistant';
import { usePlatformAssistantManual } from '@/composables/usePlatformAssistantManual';
import type { ChatComposerSubmitPayload } from '@/types/chat';
import { formatAssistantTime } from '@/utils/platform-assistant';

/**
 * 全局平台助手抽屉（设计文档 §8）。
 *
 * 后端已落地 PlatformAssistantController（全部 [AdminOnly]），本组件对接真实能力：
 * - 会话：平台助手自己的 /api/PlatformAssistant/sessions|send|history|archive（scene=platform），
 *   与页面内 Chat **完全隔离**（独立 sessionId、独立接口，不复用 Chat 会话路由）。
 * - 页面上下文：显式字段提交到 /context，展示后端核验结果与 dropped 原因；
 *   前端传入的上下文不视为已授权。
 * - SSE：事件格式与 Chat 一致，复用 useChatSession 的解析与消息状态机。
 * - 手册：索引状态 / 强制重建 / 章节检索 / 问答（章节 + 页码出处）。
 * - 写工具：SSE confirmation.required 时弹窗确认，POST /confirm 换取一次性许可
 *   （默认白名单只有只读工具，这条路径默认不激活，代码可用）。
 */
const props = defineProps<{
  open: boolean;
  /** 当前页面上下文；由 layouts/default.vue 按路由与页面选中项计算后传入 */
  context: PlatformAssistantContext;
}>();

const emit = defineEmits<{ 'update:open': [value: boolean] }>();

const assistant = usePlatformAssistant();
const {
  setContext,
  submittedEntries,
  verifiedEntries,
  verifiedContext,
  contextDrops,
  contextSyncStatus,
  contextSyncError,
  contextVerifiedAt,
  contextSubmittedAtLabel,
  retryContext,
  clearContextSelection,
  toolCatalog,
  toolCatalogLoading,
  toolCatalogError,
  loadToolCatalog,
  sessionId,
  messages,
  activeTools,
  errorMessage,
  isRunning,
  sendMessage,
  cancelRun,
  retryLastFailed,
  resetSession,
  pendingCitations,
  citationGroups,
  pendingConfirmation,
  confirmationVisible,
  pendingConfirmationToolName,
  pendingConfirmationMessage,
  confirmationState,
  confirmationError,
  confirmedWrite,
  confirmWrite,
  dismissConfirmation,
  continueAfterConfirm,
} = assistant;

const manual = usePlatformAssistantManual();
const {
  status: manualStatus,
  statusLoading: manualStatusLoading,
  statusLoaded: manualStatusLoaded,
  statusError: manualStatusError,
  manualReady,
  unavailableReason,
  reindexing,
  reindexNotice,
  reindexError,
  reindex,
  keyword,
  searchLoading,
  searchError,
  searchErrorCode,
  searchResult,
  search,
  clearSearch,
  question,
  askLoading,
  askError,
  askErrorCode,
  answer,
  ask,
  clearAnswer,
  loadStatus: loadManualStatus,
} = manual;

/** 窄屏下侧栏（工具与手册）是否展开；宽屏始终可见 */
const asideOpen = ref(false);
const expandedCitationGroupId = shallowRef('');

const hasSession = computed(() => Boolean(String(sessionId.value || '').trim()));

const sessionLabel = computed(() => {
  const id = String(sessionId.value || '').trim();
  return id ? `#${id}` : '未创建（发送第一条消息时创建）';
});

const contextSummary = computed(() => {
  const entries = submittedEntries.value;

  if (!entries.length) {
    return '未携带页面上下文';
  }

  return entries.map((entry) => `${entry.label}：${entry.value}`).join(' · ');
});

const hasChatCitations = computed(() =>
  pendingCitations.value.length > 0 || citationGroups.value.length > 0);

const pageRangeLabel = (pageStart: number, pageEnd: number): string => {
  const start = Number.isFinite(pageStart) ? pageStart : 0;
  const end = Number.isFinite(pageEnd) ? pageEnd : start;

  if (start <= 0) {
    return '页码未标注';
  }

  return end > start ? `第 ${start}-${end} 页` : `第 ${start} 页`;
};

const close = () => emit('update:open', false);

const handleSend = (payload: ChatComposerSubmitPayload) => {
  void sendMessage(payload.message, {
    attachmentFiles: payload.images,
    attachmentIds: payload.attachmentIds,
    attachmentReferences: payload.attachmentReferences,
  });
};

/** 后续建议 chip：与页面内 Chat 一致，直接作为新消息发送 */
const handleSuggestion = (text: string) => {
  const content = String(text || '').trim();

  if (!content) {
    return;
  }

  void sendMessage(content);
};

const handleResetSession = () => {
  resetSession();
  expandedCitationGroupId.value = '';
};

const handleEscape = (event: KeyboardEvent) => {
  if (event.key !== 'Escape' || !props.open) {
    return;
  }

  // 确认弹窗等 Dialog 自己响应 Esc（顶层弹窗优先），避免一次 Esc 把抽屉一起关掉
  if (typeof document !== 'undefined' && document.querySelector('[data-dialog-overlay]')) {
    return;
  }

  close();
};

const handleReindex = () => {
  void reindex();
};

const handleManualSearch = () => {
  void search();
};

const handleManualAsk = () => {
  void ask();
};

const setKeyword = (value: string) => {
  keyword.value = value;
};

const setQuestion = (value: string) => {
  question.value = value;
};

const handleConfirmWrite = () => {
  void confirmWrite();
};

const handleContinueAfterConfirm = () => {
  void continueAfterConfirm();
};

const handleConfirmOpenChange = (value: boolean) => {
  if (!value) {
    dismissConfirmation();
  }
};

// 抽屉打开时同步最新页面上下文（不继承上一次会话，但上下文跟随当前页面）
watch(
  () => props.context,
  (next) => {
    setContext(next);
  },
  { immediate: true, deep: true },
);

watch(
  () => props.open,
  (open) => {
    if (!open) {
      expandedCitationGroupId.value = '';
      asideOpen.value = false;
      return;
    }

    void loadToolCatalog();
    void loadManualStatus();
  },
);

onMounted(() => {
  window.addEventListener('keydown', handleEscape, true);

  if (props.open) {
    void loadToolCatalog();
    void loadManualStatus();
  }
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleEscape, true);
});

// 写工具确认弹窗：确认完成后保留弹窗展示"已确认"与"继续执行"
const confirmDialogToolName = computed(() => pendingConfirmationToolName.value);
const confirmDialogArgumentsHash = computed(() =>
  String(pendingConfirmation.value?.argumentsHash ?? '').trim());
const confirmDialogExpiresAt = computed(() => String(pendingConfirmation.value?.expiresAt ?? '').trim());
const confirmDialogConfirming = computed(() => confirmationState.value === 'confirming');

// 供模板使用的引用（避免在模板里直接写 option 链）
const assistantTurnActive = computed(() => isRunning.value);
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0">
      <div v-if="props.open" class="platform-assistant-root" role="presentation">
        <button
          type="button"
          class="platform-assistant-backdrop"
          aria-label="关闭平台助手"
          @click="close" />

        <aside
          id="platform-assistant-drawer"
          class="platform-assistant-panel"
          role="dialog"
          aria-modal="true"
          aria-label="平台助手">
          <header class="platform-assistant-head">
            <div class="min-w-0">
              <p class="text-sm font-medium text-foreground">平台助手</p>
              <p class="truncate text-xs text-muted-foreground">{{ contextSummary }}</p>
            </div>
            <div class="flex shrink-0 items-center gap-1">
              <button
                type="button"
                class="platform-assistant-icon-btn platform-assistant-aside-toggle"
                :title="asideOpen ? '隐藏工具与手册' : '显示工具与手册'"
                aria-label="显示或隐藏工具与手册"
                @click="asideOpen = !asideOpen">
                <AppIcon name="library" class="h-4 w-4" />
              </button>
              <button
                type="button"
                class="platform-assistant-icon-btn"
                title="清空当前助手会话（独立会话，与页面内 Chat 无关）"
                aria-label="清空当前助手会话"
                @click="handleResetSession()">
                <AppIcon name="refresh-cw" class="h-4 w-4" />
              </button>
              <button
                type="button"
                class="platform-assistant-icon-btn"
                title="关闭"
                aria-label="关闭平台助手"
                @click="close">
                <AppIcon name="x" class="h-4 w-4" />
              </button>
            </div>
          </header>

          <div class="platform-assistant-body">
            <ChatPanel
              :messages="messages"
              :tools="activeTools"
              :is-running="isRunning"
              :error-message="errorMessage"
              empty-title="问平台助手"
              empty-description="可以问操作手册（回答带章节与页码出处）、当前页面已核验的场馆/典藏/路线资料，也可以直接粘贴图片提问。本会话与页面内 Chat 完全隔离。"
              placeholder="例如：手册里怎么配置景点范围？"
              @send="handleSend"
              @cancel="cancelRun()"
              @retry="retryLastFailed()"
              @suggestion="handleSuggestion" />

            <aside class="platform-assistant-aside" :class="{ 'is-open': asideOpen }">
              <div class="platform-assistant-aside-head">
                <p class="platform-assistant-card__title">工具与手册</p>
                <button
                  type="button"
                  class="platform-assistant-icon-btn platform-assistant-aside-toggle"
                  aria-label="收起工具与手册"
                  @click="asideOpen = false">
                  <AppIcon name="x" class="h-4 w-4" />
                </button>
              </div>

              <section class="platform-assistant-card">
                <h3 class="platform-assistant-card__title">会话</h3>
                <ul class="platform-assistant-list">
                  <li class="platform-assistant-context-row">
                    <span class="text-muted-foreground">平台助手会话</span>
                    <span class="min-w-0 break-all text-right">{{ sessionLabel }}</span>
                  </li>
                  <li class="platform-assistant-context-row">
                    <span class="text-muted-foreground">运行状态</span>
                    <span>{{ assistantTurnActive ? '正在处理' : '空闲' }}</span>
                  </li>
                </ul>
                <p class="mt-2 text-[11px] leading-5 text-muted-foreground">
                  平台助手走自己的会话与接口（scene=platform，/api/PlatformAssistant/*），
                  与页面内 Chat 不共用 sessionId，也不继承路线编辑上下文。
                </p>
              </section>

              <PlatformAssistantContextPanel
                :submitted-entries="submittedEntries"
                :verified-entries="verifiedEntries"
                :verified="verifiedContext"
                :drops="contextDrops"
                :sync-status="contextSyncStatus"
                :sync-error="contextSyncError"
                :verified-at="contextVerifiedAt"
                :submitted-at="contextSubmittedAtLabel"
                :has-session="hasSession"
                :catalog="toolCatalog"
                :catalog-loading="toolCatalogLoading"
                :catalog-error="toolCatalogError"
                @refresh="retryContext()"
                @clear-selection="clearContextSelection()"
                @load-tools="loadToolCatalog()" />

              <section class="platform-assistant-card">
                <h3 class="platform-assistant-card__title">对话中的手册出处</h3>
                <p v-if="!hasChatCitations" class="text-[11px] leading-5 text-muted-foreground">
                  助手在对话中调用 AskManual / SearchManual 时，命中的章节与页码会显示在这里。
                </p>
                <template v-else>
                  <ul v-if="pendingCitations.length" class="platform-assistant-list">
                    <li
                      v-for="(hit, index) in pendingCitations"
                      :key="`pending-${hit.chapterIndex}-${hit.pageStart}-${index}`"
                      class="platform-assistant-citation">
                      <p class="flex flex-wrap items-center gap-1.5">
                        <b>{{ hit.chapterTitle || '未命名章节' }}</b>
                        <span class="text-muted-foreground">{{ pageRangeLabel(hit.pageStart, hit.pageEnd) }}</span>
                      </p>
                      <p v-if="hit.excerpt" class="mt-1 text-muted-foreground">{{ hit.excerpt }}</p>
                    </li>
                  </ul>
                  <ul v-if="citationGroups.length" class="mt-1.5 space-y-1.5">
                    <li v-for="group in citationGroups" :key="group.id" class="platform-assistant-citation-group">
                      <button
                        type="button"
                        class="platform-assistant-citation-toggle"
                        @click="expandedCitationGroupId = expandedCitationGroupId === group.id ? '' : group.id">
                        <span>历史出处 {{ group.items.length }} 条</span>
                        <span class="text-muted-foreground">{{ formatAssistantTime(group.at) }}</span>
                      </button>
                      <ul v-if="expandedCitationGroupId === group.id" class="mt-1.5 space-y-1.5">
                        <li
                          v-for="(item, index) in group.items"
                          :key="`${group.id}-${index}`"
                          class="platform-assistant-citation">
                          <p class="flex flex-wrap items-center gap-1.5">
                            <b>{{ item.chapterTitle || '未命名章节' }}</b>
                            <span class="text-muted-foreground">{{ pageRangeLabel(item.pageStart, item.pageEnd) }}</span>
                          </p>
                          <p v-if="item.excerpt" class="mt-1 text-muted-foreground">{{ item.excerpt }}</p>
                        </li>
                      </ul>
                    </li>
                  </ul>
                </template>
              </section>

              <PlatformAssistantManualPanel
                :status="manualStatus"
                :status-loading="manualStatusLoading"
                :status-loaded="manualStatusLoaded"
                :status-error="manualStatusError"
                :manual-ready="manualReady"
                :unavailable-reason="unavailableReason"
                :reindexing="reindexing"
                :reindex-notice="reindexNotice"
                :reindex-error="reindexError"
                :search-loading="searchLoading"
                :search-error="searchError"
                :search-error-code="searchErrorCode"
                :search-result="searchResult"
                :ask-loading="askLoading"
                :ask-error="askError"
                :ask-error-code="askErrorCode"
                :answer="answer"
                :keyword="keyword"
                :question="question"
                @update:keyword="setKeyword"
                @update:question="setQuestion"
                @reindex="handleReindex()"
                @refresh-status="loadManualStatus()"
                @search="handleManualSearch()"
                @ask="handleManualAsk()"
                @clear-search="clearSearch()"
                @clear-answer="clearAnswer()" />
            </aside>
          </div>

          <PlatformAssistantConfirmDialog
            :open="confirmationVisible"
            :tool-name="confirmDialogToolName"
            :message="pendingConfirmationMessage"
            :arguments-hash="confirmDialogArgumentsHash"
            :expires-at="confirmDialogExpiresAt"
            :confirming="confirmDialogConfirming"
            :error="confirmationError"
            :confirmed="confirmedWrite"
            @update:open="handleConfirmOpenChange"
            @confirm="handleConfirmWrite()"
            @continue="handleContinueAfterConfirm()" />
        </aside>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.platform-assistant-root {
  position: fixed;
  inset: 0;
  z-index: 900;
}

.platform-assistant-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(2px);
}

.platform-assistant-panel {
  position: absolute;
  inset: 0 0 0 auto;
  display: flex;
  width: min(880px, 100vw);
  max-width: 100vw;
  flex-direction: column;
  overflow: hidden;
  border-left: 1px solid rgba(209, 178, 111, 0.16);
  background: #0c0d10;
  box-shadow: -18px 0 44px rgba(0, 0, 0, 0.42);
}

.platform-assistant-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  border-bottom: 1px solid rgba(209, 178, 111, 0.14);
  padding: 0.75rem 1rem;
}

.platform-assistant-icon-btn {
  display: inline-flex;
  height: 2rem;
  width: 2rem;
  align-items: center;
  justify-content: center;
  border-radius: 0.5rem;
  color: hsl(var(--muted-foreground));
  transition: background-color 0.15s ease, color 0.15s ease;
}

.platform-assistant-icon-btn:hover {
  background: rgba(255, 255, 255, 0.06);
  color: hsl(var(--foreground));
}

.platform-assistant-body {
  position: relative;
  display: grid;
  min-height: 0;
  flex: 1;
  grid-template-columns: minmax(0, 1fr);
}

@media (min-width: 900px) {
  .platform-assistant-body {
    grid-template-columns: minmax(0, 1fr) 320px;
  }
}

.platform-assistant-body :deep(.chat-shell) {
  border: 0;
  border-radius: 0;
  box-shadow: none;
}

.platform-assistant-aside {
  display: flex;
  min-height: 0;
  flex-direction: column;
  gap: 0.75rem;
  overflow-y: auto;
  border-left: 1px solid rgba(209, 178, 111, 0.12);
  padding: 0.85rem;
}

.platform-assistant-aside-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

/* 窄屏：侧栏改为抽屉内浮层，由头部「工具与手册」按钮开关 */
@media (max-width: 899px) {
  .platform-assistant-aside {
    position: absolute;
    inset: 0 0 0 auto;
    z-index: 2;
    width: min(340px, 90vw);
    background: #0c0d10;
    box-shadow: -12px 0 30px rgba(0, 0, 0, 0.4);
    transform: translateX(100%);
    transition: transform 0.2s ease;
  }

  .platform-assistant-aside.is-open {
    transform: translateX(0);
  }
}

@media (min-width: 900px) {
  .platform-assistant-icon-btn.platform-assistant-aside-toggle {
    display: none;
  }
}

.platform-assistant-card {
  border-radius: 0.75rem;
  border: 1px solid rgba(209, 178, 111, 0.14);
  background: rgba(255, 255, 255, 0.02);
  padding: 0.7rem;
}

.platform-assistant-card__title {
  margin-bottom: 0.5rem;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(209, 178, 111, 0.72);
}

.platform-assistant-list {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.platform-assistant-context-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
  font-size: 11px;
}

.platform-assistant-citation-group {
  border-radius: 0.5rem;
  border: 1px solid rgba(255, 255, 255, 0.07);
  padding: 0.4rem 0.5rem;
}

.platform-assistant-citation-toggle {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  font-size: 11px;
}

.platform-assistant-citation {
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  padding-top: 0.4rem;
  font-size: 11px;
  line-height: 1.6;
}
</style>
