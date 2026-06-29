export default defineNuxtConfig({
  ssr: false,
  compatibilityDate: '2026-06-26',
  devtools: { enabled: true },
  app: {
    baseURL: '/path-seeker/'
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
    /**
     * Automatically add stores dirs to the auto imports. This is the same as
     * directly adding the dirs to the `imports.dirs` option. If you want to
     * also import nested stores, you can use the glob pattern `./stores/**`
     * (on Nuxt 3) or `app/stores/**` (on Nuxt 4+)
     *
     * @default `['stores']`
     */
    storesDirs: []
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
