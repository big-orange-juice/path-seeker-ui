/// <reference types="vite/client" />

declare module "*.mp4" {
  const src: string
  export default src
}

declare module "*.png" {
  const src: string
  export default src
}

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  readonly VITE_MUSEUM_ID?: string
  /** MiniMax API Key（会打进前端包，仅内测） */
  readonly VITE_MINIMAX_API_KEY?: string
  /** 留空则用 BASE_URL + minimax-tts（如 /path-seeker/client/minimax-tts） */
  readonly VITE_MINIMAX_TTS_BASE_URL?: string
  readonly VITE_MINIMAX_TTS_MODEL?: string
  readonly VITE_MINIMAX_TTS_VOICE_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
