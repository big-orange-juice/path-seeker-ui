export default defineNuxtConfig({
  ssr: false,
  compatibilityDate: '2026-06-26',
  devtools: { enabled: true },
  modules: [
    '@nuxtjs/tailwindcss',
    'shadcn-nuxt',
    '@pinia/nuxt',
    '@vueuse/nuxt',
    '@formkit/auto-animate/nuxt',
    '@nuxt/icon',
    '@nuxt/image',
    '@nuxt/eslint'
  ],
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

