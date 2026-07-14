<script setup lang="ts">
import { nextTick, useTemplateRef, watch } from "vue"
import { useRouter } from "vue-router"
import { Maximize2, Minimize2, Send, X } from "lucide-vue-next"
import { storeToRefs } from "pinia"
import { useAskStore } from "@/stores/useAskStore"

interface Props {
  fullPage?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  fullPage: false,
})

const router = useRouter()
const askStore = useAskStore()
const { open, typing, attachment, messages } = storeToRefs(askStore)
const msgsRef = useTemplateRef<HTMLElement>("msgsEl")
const draft = useTemplateRef<HTMLInputElement>("draftEl")

async function scrollToBottom() {
  await nextTick()
  if (msgsRef.value) {
    msgsRef.value.scrollTop = msgsRef.value.scrollHeight
  }
}

watch(
  [messages, typing, open],
  () => {
    void scrollToBottom()
  },
  { deep: true },
)

function handleSubmit(event: Event) {
  event.preventDefault()
  const input = draft.value
  const text = input?.value?.trim() || ""
  if (!text) {
    return
  }
  if (input) {
    input.value = ""
  }
  askStore.send(text)
}

function maximize() {
  askStore.closeAsk()
  void router.push("/shell/ask")
}

function minifyToSheet() {
  askStore.openAsk({ keepAttachment: true, autoAttach: false })
  void router.push("/shell/hall")
}

function close() {
  if (props.fullPage) {
    void router.push("/shell/hall")
    return
  }
  askStore.closeAsk()
}

const kindLabel: Record<string, string> = {
  artifact: "展品",
  chapter: "这一站",
  mission: "任务",
}
</script>

<template>
  <div
    class="ask-layer"
    :class="{
      'is-open': fullPage || open,
      'is-full': fullPage,
    }"
  >
    <div v-if="!fullPage" class="ask-mask" @click="close()" />
    <div class="ask-panel" role="dialog" aria-label="问一问">
      <header class="ask-head">
        <div>
          <p class="ask-kicker">馆内小助手</p>
          <h2 class="ask-title">问一问</h2>
        </div>
        <div class="flex gap-1.5">
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

      <div v-if="attachment" class="ask-attach">
        <div class="min-w-0 flex-1 space-y-0.5">
          <span class="text-[0.65rem] font-bold tracking-wide text-primary">
            {{ kindLabel[attachment.kind] || "任务" }}
          </span>
          <p class="truncate text-sm font-semibold text-foreground">{{ attachment.title }}</p>
          <p v-if="attachment.subtitle" class="truncate text-xs text-muted-foreground">
            {{ attachment.subtitle }}
          </p>
        </div>
        <button
          type="button"
          class="ask-icon-btn h-7 w-7 min-h-0 min-w-0 rounded-full p-0"
          aria-label="去掉附带"
          @click="askStore.clearAttachment()"
        >
          <X class="h-3 w-3" />
        </button>
      </div>
      <div v-else class="ask-attach ask-attach-empty">
        <span>没有附带内容，也可以随便问</span>
      </div>

      <div ref="msgsEl" class="ask-msgs">
        <div
          v-if="!messages.length"
          class="ask-bubble is-bot"
        >
          你好。想找展品、听故事，或问这一站怎么走，都可以跟我说。
        </div>
        <div
          v-for="(msg, index) in messages"
          :key="`${msg.role}-${index}-${msg.text.slice(0, 12)}`"
          class="ask-bubble"
          :class="msg.role === 'user' ? 'is-user' : 'is-bot'"
        >
          {{ msg.text }}
        </div>
        <div v-if="typing" class="ask-bubble is-bot is-typing">…</div>
      </div>

      <form class="ask-composer" @submit="handleSubmit">
        <input
          ref="draftEl"
          class="ask-input"
          type="text"
          placeholder="问问位置、故事或观察重点…"
          autocomplete="off"
        >
        <button type="submit" class="ask-send" aria-label="发送">
          <Send class="h-4 w-4" />
        </button>
      </form>
    </div>
  </div>
</template>
