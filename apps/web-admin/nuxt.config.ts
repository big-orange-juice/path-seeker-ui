export default defineNuxtConfig({
  ssr: false,
  compatibilityDate: '2026-06-26',
  devtools: { enabled: true },
  app: {
    baseURL: '/path-seeker/'
  },
  runtimeConfig: {
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
    '@nuxt/eslint'
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
  }
});
