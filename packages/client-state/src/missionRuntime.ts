import { computed, shallowRef } from "vue"
import { acceptHMRUpdate, defineStore } from "pinia"

export interface MissionSubmitFeedbackState {
  visible: boolean
  title: string
  message: string
  canAdvance: boolean
  finalChapter: boolean
}

function createEmptyFeedbackState(): MissionSubmitFeedbackState {
  return {
    visible: false,
    title: "",
    message: "",
    canAdvance: false,
    finalChapter: false,
  }
}

export const useMissionRuntimeStore = defineStore("client-mission-runtime", () => {
  const submitFeedback = shallowRef<MissionSubmitFeedbackState>(createEmptyFeedbackState())

  const feedbackVisible = computed(() => submitFeedback.value.visible)

  function openSubmitFeedback(payload: Omit<MissionSubmitFeedbackState, "visible">) {
    submitFeedback.value = {
      visible: true,
      ...payload,
    }
  }

  function closeSubmitFeedback() {
    submitFeedback.value = createEmptyFeedbackState()
  }

  return {
    submitFeedback,
    feedbackVisible,
    openSubmitFeedback,
    closeSubmitFeedback,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useMissionRuntimeStore, import.meta.hot))
}
