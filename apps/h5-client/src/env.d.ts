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
  readonly VITE_TENCENT_MAP_KEY?: string
  /** 问一问未选导游音色时的默认 voiceId */
  readonly VITE_ASK_DEFAULT_VOICE_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
