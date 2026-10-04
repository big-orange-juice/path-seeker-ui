<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, useTemplateRef, watch } from "vue"
import { useRouter } from "vue-router"
import {
  AudioLines,
  Maximize2,
  MessageCircle,
  Mic,
  MicOff,
  Minimize2,
  RefreshCw,
  Send,
  Square,
  X,
} from "lucide-vue-next"
import { storeToRefs } from "pinia"
import { useToastStore } from "@path-seeker/client-state"
import AskLocationCard from "@/components/shell/AskLocationCard.vue"
import AskMarkdown from "@/components/shell/AskMarkdown.vue"
import { useAskSpeech } from "@/composables/useAskSpeech"
import { useBrowserSpeechRecognition } from "@/composables/useBrowserSpeechRecognition"
import {
  extractAskUserInstruction,
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
  draftText,
  draftFocusToken,
} = storeToRefs(askStore)

const speech = useAskSpeech()
/** 与行程页语音键共用同一个识别单例：这里只做状态展示与开关 */
const recognition = useBrowserSpeechRecognition()
const msgsRef = useTemplateRef<HTMLElement>("msgsEl")
const draft = useTemplateRef<HTMLInputElement>("draftEl")

const isVoiceMode = computed(() => interactionMode.value === "voice")

/** 识别结果实时写进输入框；结束时临时结果清空，草稿收敛为最终文本 */
watch(() => recognition.transcript.value, (text) => {
  askStore.setDraftText(text)
})

/**
 * 字幕跟读：只显示当前正在朗读的那一句。
 * 识别期间的实时听写由输入框本身承担，不在这里重复一遍。
 */
const liveCaption = computed(() => speech.speakingSentence.value)

const showSpeechProgress = computed(() => Boolean(speech.speakingSentence.value))

/** 状态行提示；与相位同一行显示，过长时截断 */
const voiceHintText = computed(() => {
  if (recognition.listening.value) return "正在识别你说的话，松开即发送"
  if (speech.voicePhase.value === "speaking") return "正在朗读回复，开口说话可打断"
  if (speech.voicePhase.value === "thinking") return "正在组织回答…"
  return "回复会出现在下方气泡，可点位置卡"
})

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

/** 说话打断的状态说明；只在播放期真正监听，其余时间不消费麦克风 */
const bargeInTitle = computed(() => {
  if (!speech.bargeInEnabled.value) return "已关闭：不会使用麦克风"
  if (speech.bargeInListening.value) return "正在监听：开口即打断朗读"
  if (speech.bargeInArmed.value) return "已就绪：朗读开始后开口即可打断"
  return "点击开启：只在朗读期间使用麦克风，音频不上传、不录制"
})

// 语音识别不可用时，行程页会请求把焦点移到输入框，直接切到打字
watch(draftFocusToken, () => {
  void nextTick(() => {
    draft.value?.focus()
  })
})

async function scrollToBottom() {
  await nextTick()
  if (msgsRef.value) {
    msgsRef.value.scrollTop = msgsRef.value.scrollHeight
  }
}

// 语音/文字模式统一滚到底：语音也渲染气泡，位置卡需可点
watch(
  [messages, typing, open, interactionMode],
  () => {
    void scrollToBottom()
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
  const text = draftText.value.trim()
  if (!text || typing.value) {
    return
  }
  if (isVoiceMode.value) {
    speech.unlock()
  }
  askStore.clearDraftText()
  void askStore.send(text)
}

function switchMode(mode: AskInteractionMode) {
  if (mode === interactionMode.value) {
    return
  }
  if (mode === "voice") {
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
  // 全页问一问收回底部面板：有历史就回上一页，否则回户外主线
  if (window.history.length > 1) {
    void router.back()
    return
  }
  void router.replace("/ride")
}

function close() {
  if (props.fullPage) {
    // 优先回上一页（如从路线 map 最大化进入），无历史再回户外主线
    if (window.history.length > 1) {
      void router.back()
      return
    }
    void router.replace("/ride")
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

/** 建议放到输入框上方独立一行（对齐 demo），取最后一条助手消息的后续建议 */
const composerSuggestions = computed(() => {
  for (let index = messages.value.length - 1; index >= 0; index -= 1) {
    const item = messages.value[index]
    if (item?.role === "assistant" && canUseSuggestions(item)) {
      return (item.suggestions ?? []).map((text) => String(text ?? "").trim()).filter(Boolean)
    }
  }
  return []
})

/** 松开麦克风后自动发送（demo 的「按住说话，松开后发送」） */
let autoSendOnRelease = false

function startVoiceHold() {
  if (recognition.listening.value) return
  if (isVoiceMode.value) {
    speech.unlock()
  }
  startVoiceAskCapture()
}

/** 按下即打断正在播的内容并开始识别 */
function startVoiceAskCapture() {
  askStore.stopSseAudio()
  recognition.start()
}

function finishVoiceHold() {
  if (!recognition.listening.value) return
  autoSendOnRelease = true
  recognition.stop()
}

watch(() => recognition.listening.value, async (now, before) => {
  if (!before || now || !autoSendOnRelease) return
  autoSendOnRelease = false
  // 等草稿写入完成再发，避免读到上一轮的文本
  await nextTick()
  const text = draftText.value.trim()
  if (!text || typing.value) return
  askStore.clearDraftText()
  void askStore.send(text)
})
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
            <p class="ask-kicker">户外小助手</p>
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
            v-if="speech.bargeInSupported.value"
            type="button"
            class="ask-icon-btn"
            :class="{ 'is-on': speech.bargeInEnabled.value }"
            :aria-pressed="speech.bargeInEnabled.value"
            :title="bargeInTitle"
            aria-label="说话打断"
            @click="speech.toggleBargeIn(!speech.bargeInEnabled.value)"
          >
            <Mic v-if="speech.bargeInEnabled.value" class="h-4 w-4" />
            <MicOff v-else class="h-4 w-4" />
          </button>
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

      <!-- 语音状态：对齐 demo 的 .ask-status，单行「相位 + 提示」 -->
      <div
        v-if="isVoiceMode"
        class="ask-voice-bar"
        aria-live="polite"
      >
        <strong class="ask-voice-phase">{{ voicePhaseLabel }}</strong>
        <span class="ask-voice-hint">{{ voiceHintText }}</span>
      </div>

      <!-- 字幕跟读：正在朗读的那一句 + 句内进度 -->
      <div
        v-if="liveCaption"
        class="ask-voice-caption-row"
      >
        <p class="ask-voice-caption">
          {{ liveCaption }}
        </p>
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
      <span
        v-if="showSpeechProgress"
        class="ask-voice-progress"
        aria-hidden="true"
      >
        <i :style="{ transform: `scaleX(${speech.speakingProgress.value})` }" />
      </span>

      <div ref="msgsEl" class="ask-msgs">
        <div
          v-if="!messages.length && !historyPending"
          class="ask-welcome"
        >
          <p class="ask-welcome-title">你好，我在路上。</p>
          <p class="ask-welcome-copy">
            {{
              isVoiceMode
                ? "打字提问，我会朗读回复；位置等信息可在气泡里点开。"
                : "想了解这一站的故事、路线怎么走，都可以跟我说。"
            }}
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
              {{ extractAskUserInstruction(msg.content) }}
            </template>
            <template v-else>
              <!-- 正文仅视觉展示；语音模式朗读由 SSE 音频负责，不另起字幕轨 -->
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

              <span
                v-if="msg.interrupted"
                class="ask-interrupted-tag"
              >
                <MicOff class="h-3 w-3" />
                已被说话打断
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

              <AskLocationCard
                v-if="msg.locations?.length"
                :locations="msg.locations"
              />

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

      <!-- 后续建议：对齐 demo，放在输入框上方独立一行 -->
      <div
        v-if="composerSuggestions.length"
        class="ask-suggestions"
      >
        <button
          v-for="item in composerSuggestions"
          :key="item"
          type="button"
          class="ask-suggestion-chip"
          :disabled="typing"
          @click="handleSuggestion(item)"
        >
          {{ item }}
          <ArrowUpRight class="h-3 w-3" />
        </button>
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
            aria-label="取消当前站点信息"
            :disabled="typing"
            @click="askStore.clearStageContext()"
          >
            <X class="h-3.5 w-3.5" />
          </button>
        </div>
        <div class="ask-composer-inner">
          <input
            ref="draftEl"
            v-model="draftText"
            class="ask-input"
            type="text"
            :placeholder="isVoiceMode ? '按住说话，松开后发送…' : '问问位置、故事或观察重点…'"
            autocomplete="off"
            :disabled="typing"
            maxlength="2000"
          >
          <button
            v-if="isVoiceMode && recognition.supported.value"
            type="button"
            class="ask-mic-button"
            :class="{ 'is-listening': recognition.listening.value }"
            :aria-pressed="recognition.listening.value"
            aria-label="按住说话"
            title="按住说话，松开后发送"
            @pointerdown.prevent="startVoiceHold"
            @pointerup.prevent="finishVoiceHold"
            @pointercancel.prevent="finishVoiceHold"
            @pointerleave="finishVoiceHold"
          >
            <span
              v-if="recognition.listening.value"
              class="ask-voice-wave"
              aria-hidden="true"
            ><i /><i /><i /><i /></span>
            <Mic v-else class="h-4 w-4" />
          </button>
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

      <p
        v-if="recognition.error.value || speech.bargeInError.value"
        class="ask-note"
        role="status"
      >
        {{ recognition.error.value || speech.bargeInError.value }}
      </p>
    </div>
  </div>
</template>
