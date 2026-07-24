<script setup lang="ts">
import { useRoute, useRouter } from "vue-router"
import { ClientDialog } from "@/components/ui"
import { useAuthStore } from "@/stores/useAuthStore"

const authStore = useAuthStore()
const route = useRoute()
const router = useRouter()

async function handleConfirm() {
  authStore.closeSessionExpiredDialog()
  authStore.logout()

  const current = String(route.fullPath || "").trim()
  const redirect =
    current && current !== "/auth" && !current.startsWith("/auth?")
      ? current
      : ""

  await router.replace({
    path: "/auth",
    query: redirect ? { redirect } : undefined,
  })
}
</script>

<template>
  <ClientDialog
    :open="authStore.sessionExpiredDialogOpen"
    title="登录状态已失效"
    :description="authStore.sessionExpiredMessage"
    confirm-text="重新登录"
    :show-cancel="false"
    @update:open="(open) => { if (!open) handleConfirm() }"
    @confirm="handleConfirm"
  />
</template>
