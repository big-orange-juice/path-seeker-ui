/** 未选择导游音色时的默认 voiceId（与后端 MiniMax 系统音色一致） */
const DEFAULT_ASK_VOICE_ID = "male-qn-qingse"

/**
 * 解析 send-with-audio 的 voiceId 回落值。
 * 优先 env `VITE_ASK_DEFAULT_VOICE_ID`，否则内置默认。
 */
export function getDefaultAskVoiceId() {
  return String(import.meta.env.VITE_ASK_DEFAULT_VOICE_ID || "").trim() || DEFAULT_ASK_VOICE_ID
}
