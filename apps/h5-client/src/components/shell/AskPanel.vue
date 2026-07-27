<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, useTemplateRef, watch } from "vue"
import { useRouter } from "vue-router"
import {
  AudioLines,
  Maximize2,
  MessageCircle,
  Minimize2,
  RefreshCw,
  Send,
  Square,
  X,
} from "lucide-vue-next"
import { storeToRefs } from "pinia"
import { useToastStore } from "@path-seeker/client-state"
import AskMarkdown from "@/components/shell/AskMarkdown.vue"
import { useAskSpeech } from "@/composables/useAskSpeech"
import { isMiniMaxTtsConfigured } from "@/services/minimaxTts"
import {
  formatStageContextChipLabel,
  useAskStore,
  type AskInteractionMode,
} from "@/stores/useAskStore"

interface Props {
  fullPage?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  fullPage: false,
})

const router = useRouter()
const toastStore = useToastStore()
const askStore = useAskStore()
const {
  open,
  typing,
  messages,
  errorMessage,
  historyPending,
  interactionMode,
  stageContext,
  hasStageContext,
} = storeToRefs(askStore)

const speech = useAskSpeech()
const msgsRef = useTemplateRef<HTMLElement>("msgsEl")
const draft = useTemplateRef<HTMLInputElement>("draftEl")

const isVoiceMode = computed(() => interactionMode.value === "voice")

const voicePhaseLabel = computed(() => {
  switch (speech.voicePhase.value) {
    case "thinking":
      return "思考中"
    case "speaking":
      return "朗读中"
    default:
      return "就绪"
  }
})

async function scrollToBottom() {
  await nextTick()
  if (msgsRef.value) {
    msgsRef.value.scrollTop = msgsRef.value.scrollHeight
  }
}

watch(
  [messages, typing, open, interactionMode],
  () => {
    if (!isVoiceMode.value) {
      void scrollToBottom()
    }
  },
  { deep: true },
)

watch(
  () => speech.speakError.value,
  (value) => {
    if (value && isVoiceMode.value) {
      toastStore.warning("朗读失败", value)
    }
  },
)

onMounted(() => {
  if (props.fullPage || open.value) {
    void askStore.ensureSession().then(() => askStore.loadHistory())
  }
})

onUnmounted(() => {
  speech.dispose()
})

watch(open, (value) => {
  if (value) {
    void askStore.ensureSession().then(() => {
      if (!messages.value.length) {
        void askStore.loadHistory()
      }
    })
  }
})

function handleSubmit(event: Event) {
  event.preventDefault()
  const input = draft.value
  const text = input?.value?.trim() || ""
  if (!text || typing.value) {
    return
  }
  if (isVoiceMode.value) {
    speech.unlock()
  }
  if (input) {
    input.value = ""
  }
  void askStore.send(text)
}

function switchMode(mode: AskInteractionMode) {
  if (mode === interactionMode.value) {
    return
  }
  if (mode === "voice") {
    if (!isMiniMaxTtsConfigured()) {
      toastStore.warning("暂不可用", "未配置语音密钥，请检查本地环境变量。")
      return
    }
    speech.unlock()
  }
  askStore.setInteractionMode(mode)
}

function maximize() {
  askStore.closeAsk()
  void router.push("/shell/ask")
}

function minifyToSheet() {
  askStore.openAsk()
  void router.push("/shell/hall")
}

function close() {
  if (props.fullPage) {
    void router.push("/shell/hall")
    return
  }
  askStore.closeAsk()
}

function isLastFailedAssistant(index: number) {
  const msg = messages.value[index]
  if (!msg || msg.role !== "assistant" || msg.status !== "failed") {
    return false
  }
  for (let i = messages.value.length - 1; i >= 0; i -= 1) {
    if (messages.value[i]?.role === "assistant") {
      return i === index
    }
  }
  return false
}

function isStreamingAssistant(msg: { role: string; status?: string }) {
  return msg.role === "assistant" && (msg.status === "streaming" || msg.status === "pending")
}

function canUseSuggestions(msg: {
  role: string
  status?: string
  suggestions?: string[]
}) {
  return (
    msg.role === "assistant"
    && msg.status === "completed"
    && Array.isArray(msg.suggestions)
    && msg.suggestions.some((item) => String(item ?? "").trim())
  )
}

function handleSuggestion(text: string) {
  const trimmed = text.trim()
  if (!trimmed || typing.value) {
    return
  }
  if (isVoiceMode.value) {
    speech.unlock()
  }
  void askStore.send(trimmed)
}
</script>

<template>
  <div
    class="ask-layer"
    :class="{
      'is-open': fullPage || open,
      'is-full': fullPage,
      'is-voice': isVoiceMode,
    }"
  >
    <div v-if="!fullPage" class="ask-mask" @click="close()" />
    <div class="ask-panel" role="dialog" aria-label="问一问">
      <div v-if="!fullPage" class="ask-grab" aria-hidden="true">
        <span class="ask-grab-bar" />
      </div>

      <header class="ask-head">
        <div class="ask-brand">
          <span class="ask-avatar" aria-hidden="true">
            <AudioLines v-if="isVoiceMode" class="h-4 w-4" />
            <MessageCircle v-else class="h-4 w-4" />
          </span>
          <div class="min-w-0">
            <p class="ask-kicker">馆内小助手</p>
            <h2 class="ask-title">
              {{ isVoiceMode ? "语音模式" : "问一问" }}
            </h2>
          </div>
        </div>
        <div class="ask-head-actions">
          <div class="ask-mode-switch" role="group" aria-label="交互模式">
            <button
              type="button"
              class="ask-mode-btn"
              :class="{ 'is-active': !isVoiceMode }"
              title="文字模式"
              aria-label="文字模式"
              @click="switchMode('text')"
            >
              <MessageCircle class="h-3.5 w-3.5" />
              <span class="ask-mode-btn-label">文字</span>
            </button>
            <button
              type="button"
              class="ask-mode-btn"
              :class="{ 'is-active': isVoiceMode }"
              title="语音模式"
              aria-label="语音模式"
              @click="switchMode('voice')"
            >
              <AudioLines class="h-3.5 w-3.5" />
              <span class="ask-mode-btn-label">语音</span>
            </button>
          </div>
          <button
            v-if="fullPage"
            type="button"
            class="ask-icon-btn"
            title="收起为浮层"
            @click="minifyToSheet()"
          >
            <Minimize2 class="h-4 w-4" />
          </button>
          <button
            v-else
            type="button"
            class="ask-icon-btn"
            title="放大"
            @click="maximize()"
          >
            <Maximize2 class="h-4 w-4" />
          </button>
          <button type="button" class="ask-icon-btn" title="关闭" @click="close()">
            <X class="h-4 w-4" />
          </button>
        </div>
      </header>

      <div v-if="errorMessage" class="ask-banner is-error" role="alert">
        {{ errorMessage }}
      </div>
      <div v-else-if="historyPending" class="ask-banner is-muted">
        正在加载历史…
      </div>

      <!-- 语音模式：状态 + 字幕（无动画球） -->
      <div v-if="isVoiceMode" class="ask-voice">
        <p class="ask-voice-phase">{{ voicePhaseLabel }}</p>

        <div v-if="speech.lastUserText.value" class="ask-voice-user">
          <span class="ask-voice-label">你</span>
          <p>{{ speech.lastUserText.value }}</p>
        </div>

        <div class="ask-voice-caption">
          <span class="ask-voice-label">助手</span>
          <p v-if="speech.captionText.value">{{ speech.captionText.value }}</p>
          <p v-else class="ask-voice-placeholder">
            {{
              speech.voicePhase.value === "thinking"
                ? "正在组织回答…"
                : "打字提问，我会朗读回复"
            }}
          </p>
        </div>

        <button
          v-if="speech.isSpeaking.value"
          type="button"
          class="ask-voice-stop"
          @click="speech.stopSpeaking()"
        >
          <Square class="h-3 w-3" />
          停止朗读
        </button>
      </div>

      <!-- 文字模式：消息列表 -->
      <div v-else ref="msgsEl" class="ask-msgs">
        <div
          v-if="!messages.length && !historyPending"
          class="ask-welcome"
        >
          <p class="ask-welcome-title">你好，我在展厅里。</p>
          <p class="ask-welcome-copy">
            想找展品、听故事，或问这一站怎么走，都可以跟我说。
          </p>
        </div>

        <div
          v-for="(msg, index) in messages"
          :key="msg.id"
          class="ask-row"
          :class="{
            'is-user': msg.role === 'user',
            'is-bot': msg.role === 'assistant',
          }"
        >
          <div
            class="ask-bubble"
            :class="{
              'is-user': msg.role === 'user',
              'is-bot': msg.role === 'assistant',
              'is-failed': msg.status === 'failed',
              'is-live': isStreamingAssistant(msg),
            }"
          >
            <template v-if="msg.role === 'user'">
              {{ msg.content }}
            </template>
            <template v-else>
              <AskMarkdown
                v-if="msg.content"
                :markdown="msg.content"
                :streaming="isStreamingAssistant(msg)"
              />
              <span
                v-else-if="isStreamingAssistant(msg)"
                class="ask-typing"
                aria-label="正在回复"
              >
                <i /><i /><i />
              </span>
              <span v-else-if="msg.status === 'failed'" class="ask-fail-text">
                {{ msg.errorMessage || "回复失败" }}
              </span>

              <div
                v-if="msg.sources?.length"
                class="ask-sources"
              >
                <span class="ask-sources-label">相关</span>
                <span
                  v-for="(source, sourceIndex) in msg.sources"
                  :key="`${source.exhibitId || source.name}-${sourceIndex}`"
                  class="ask-source-chip"
                >
                  {{ source.name || source.formalName || "相关展品" }}
                </span>
              </div>

              <div
                v-if="canUseSuggestions(msg)"
                class="ask-suggestions"
              >
                <button
                  v-for="(item, suggestionIndex) in (msg.suggestions || []).filter((text) => String(text || '').trim())"
                  :key="`${msg.id}-sg-${suggestionIndex}`"
                  type="button"
                  class="ask-suggestion-chip"
                  :disabled="typing"
                  @click="handleSuggestion(item)"
                >
                  {{ item }}
                </button>
              </div>

              <button
                v-if="isLastFailedAssistant(index)"
                type="button"
                class="ask-retry"
                @click="askStore.retryLastFailed()"
              >
                <RefreshCw class="h-3 w-3" />
                重试
              </button>
            </template>
          </div>
        </div>

        <div
          v-if="typing && !messages.some((item) => item.role === 'assistant' && (item.status === 'pending' || item.status === 'streaming'))"
          class="ask-row is-bot"
        >
          <div class="ask-bubble is-bot is-live">
            <span class="ask-typing" aria-label="正在回复">
              <i /><i /><i />
            </span>
          </div>
        </div>
      </div>

      <form class="ask-composer" @submit="handleSubmit">
        <div
          v-if="hasStageContext && stageContext"
          class="ask-context-chip"
        >
          <div class="ask-context-chip-body">
            <span class="ask-context-chip-label">附件</span>
            <span class="ask-context-chip-text">
              {{ formatStageContextChipLabel(stageContext) }}
            </span>
          </div>
          <button
            type="button"
            class="ask-context-chip-remove"
            title="取消附件"
            aria-label="取消站点上下文附件"
            :disabled="typing"
            @click="askStore.clearStageContext()"
          >
            <X class="h-3.5 w-3.5" />
          </button>
        </div>
        <div class="ask-composer-inner">
          <input
            ref="draftEl"
            class="ask-input"
            type="text"
            :placeholder="isVoiceMode ? '打字提问，回复将朗读…' : '问问位置、故事或观察重点…'"
            autocomplete="off"
            :disabled="typing"
            maxlength="2000"
          >
          <button
            type="submit"
            class="ask-send"
            aria-label="发送"
            :disabled="typing"
          >
            <Send class="h-4 w-4" />
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
