import { fileURLToPath, URL } from "node:url"
import { defineConfig } from "vite"
import vue from "@vitejs/plugin-vue"

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@path-seeker/client-state": fileURLToPath(new URL("../../packages/client-state/src/index.ts", import.meta.url)),
      "@path-seeker/game-runtime": fileURLToPath(new URL("../../packages/game-runtime/src/index.ts", import.meta.url)),
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5174,
  },
})
