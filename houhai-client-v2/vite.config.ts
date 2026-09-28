import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  base: './',
  server: {
    strictPort: true,
    proxy: {
      '/duplex': {
        target: 'http://127.0.0.1:5178',
        rewrite: path => path.replace(/^\/duplex/, ''),
        ws: true,
      },
    },
  },
})
