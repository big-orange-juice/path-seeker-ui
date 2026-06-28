import { fileURLToPath, URL } from "node:url"
import { defineConfig } from "vite"
import uni from "@dcloudio/vite-plugin-uni"

export default defineConfig({
  plugins: [uni()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@vue/devtools-api": fileURLToPath(new URL("./src/shims/devtools-api.ts", import.meta.url)),
    },
  },
})
