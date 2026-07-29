import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

const rootDir = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  plugins: [vue()],
  base: '/path-seeker/client/',
  resolve: {
    // monorepo 下避免 vue/pinia 被打成多份 → 生产环境 useStore 读不到 active pinia（_s undefined）
    dedupe: ['vue', 'pinia', 'vue-router'],
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@path-seeker/client-state': fileURLToPath(
        new URL('../../packages/client-state/src/index.ts', import.meta.url)
      ),
      '@path-seeker/game-runtime': fileURLToPath(
        new URL('../../packages/game-runtime/src/index.ts', import.meta.url)
      ),
      // 强制所有依赖共用同一份 vue / pinia
      vue: fileURLToPath(new URL('./node_modules/vue', import.meta.url)),
      pinia: fileURLToPath(new URL('./node_modules/pinia', import.meta.url)),
      'vue-router': fileURLToPath(
        new URL('./node_modules/vue-router', import.meta.url)
      )
    }
  },
  optimizeDeps: {
    include: ['vue', 'pinia', 'vue-router', 'pinia-plugin-persistedstate']
  },
  build: {
    // 便于排查重复依赖；体积略增可接受
    commonjsOptions: {
      include: [/node_modules/]
    }
  },
  server: {
    host: '0.0.0.0',
    port: 5174,
    fs: {
      // 允许读 monorepo packages
      allow: [rootDir, fileURLToPath(new URL('../..', import.meta.url))]
    },
    // MiniMax T2A 浏览器直连会 CORS；开发期同源代理
    // 路径须与 base（/path-seeker/client/）+ services/minimaxTts 一致
    // 业务接口由 VITE_API_BASE_URL 直连后端，不在此转发
    proxy: {
      '/path-seeker/client/minimax-tts': {
        target: 'https://api.minimaxi.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) =>
          path.replace(/^\/path-seeker\/client\/minimax-tts/, '')
      },
      // 兼容旧根路径（若本地仍有硬编码 /minimax-tts）
      '/minimax-tts': {
        target: 'https://api.minimaxi.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/minimax-tts/, '')
      }
    }
  },
  preview: {
    proxy: {
      '/path-seeker/client/minimax-tts': {
        target: 'https://api.minimaxi.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) =>
          path.replace(/^\/path-seeker\/client\/minimax-tts/, '')
      },
      '/minimax-tts': {
        target: 'https://api.minimaxi.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/minimax-tts/, '')
      }
    }
  }
});
