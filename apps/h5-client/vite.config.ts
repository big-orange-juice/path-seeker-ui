import { fileURLToPath, URL } from "node:url"
import { defineConfig } from "vite"
import vue from "@vitejs/plugin-vue"

const rootDir = fileURLToPath(new URL(".", import.meta.url))

export default defineConfig({
  plugins: [vue()],
  resolve: {
    // monorepo 下避免 vue/pinia 被打成多份 → 生产环境 useStore 读不到 active pinia（_s undefined）
    dedupe: ["vue", "pinia", "vue-router"],
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@path-seeker/client-state": fileURLToPath(new URL("../../packages/client-state/src/index.ts", import.meta.url)),
      "@path-seeker/game-runtime": fileURLToPath(new URL("../../packages/game-runtime/src/index.ts", import.meta.url)),
      // 强制所有依赖共用同一份 vue / pinia
      vue: fileURLToPath(new URL("./node_modules/vue", import.meta.url)),
      pinia: fileURLToPath(new URL("./node_modules/pinia", import.meta.url)),
      "vue-router": fileURLToPath(new URL("./node_modules/vue-router", import.meta.url)),
    },
  },
  optimizeDeps: {
    include: ["vue", "pinia", "vue-router", "pinia-plugin-persistedstate"],
  },
  build: {
    // 便于排查重复依赖；体积略增可接受
    commonjsOptions: {
      include: [/node_modules/],
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5174,
    fs: {
      // 允许读 monorepo packages
      allow: [rootDir, fileURLToPath(new URL("../..", import.meta.url))],
    },
  },
})
