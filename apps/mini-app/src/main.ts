import App from "./App.vue"
import { createPinia } from "pinia"

// #ifdef VUE3
import { createSSRApp } from "vue"

export function createApp() {
  const app = createSSRApp(App)
  app.use(createPinia())

  return {
    app
  }
}
// #endif
