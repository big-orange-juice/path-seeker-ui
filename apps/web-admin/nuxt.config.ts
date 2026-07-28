import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * 显式加载 .env*（低优先级 → 高优先级），保证 runtimeConfig 能读到 NUXT_*。
 * 仅有 .env.development / .env.production、没有根 .env 时，Nuxt 默认链路偶发读不到。
 * 已在 shell 里 export 的变量不会被覆盖。
 */
function loadLocalEnvFiles() {
  const presetKeys = new Set(Object.keys(process.env))
  const root = process.cwd()
  // nuxt dev 时 NODE_ENV 可能尚未是 development，按非 production 处理
  const mode = process.env.NODE_ENV === 'production' ? 'production' : 'development'
  const files = ['.env', '.env.local', `.env.${mode}`, `.env.${mode}.local`]

  for (const name of files) {
    const fullPath = resolve(root, name)
    if (!existsSync(fullPath)) continue

    const text = readFileSync(fullPath, 'utf8')
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim()
      if (!line || line.startsWith('#')) continue

      const eq = line.indexOf('=')
      if (eq <= 0) continue

      const key = line.slice(0, eq).trim()
      if (!key || presetKeys.has(key)) continue

      let value = line.slice(eq + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"'))
        || (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }

      process.env[key] = value
    }
  }
}

loadLocalEnvFiles()

export default defineNuxtConfig({
  ssr: false,
  compatibilityDate: '2026-06-26',
  devtools: { enabled: true },
  app: {
    baseURL: '/path-seeker/admin/',
    head: {
      // 浏览器标签默认标题；页面级 title 由 app.vue titleTemplate 拼接
      title: 'Path Seeker 秘径寻踪',
      meta: [
        {
          name: 'description',
          content: 'Path Seeker 秘径寻踪 · 博物馆探索管理后台',
        },
      ],
    },
  },
  runtimeConfig: {
    // 私有：仅服务端；可用环境变量 NUXT_BACKEND_BASE_URL 覆盖
    backendBaseUrl: process.env.NUXT_BACKEND_BASE_URL || '',
    public: {
      museumId: process.env.NUXT_PUBLIC_MUSEUM_ID || '1'
    }
  },
  modules: [
    '@nuxtjs/tailwindcss',
    'shadcn-nuxt',
    '@pinia/nuxt',
    'pinia-plugin-persistedstate/nuxt',
    '@vueuse/nuxt',
    '@formkit/auto-animate/nuxt',
    '@nuxt/image',
    '@nuxt/eslint',
    '@comark/nuxt'
  ],
  pinia: {
    storesDirs: ['./app/stores/**']
  },
  tailwindcss: {
    cssPath: '~/assets/css/main.css',
    viewer: false
  },
  shadcn: {
    prefix: '',
    componentDir: '@/components/shadcn'
  },
  image: {
    provider: 'ipx',
    format: ['webp', 'avif']
  },
})
