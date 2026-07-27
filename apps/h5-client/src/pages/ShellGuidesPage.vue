<script setup lang="ts">
import { computed, onMounted, shallowRef } from "vue"
import { useRouter } from "vue-router"
import { ChevronRight, UserRound } from "lucide-vue-next"
import { ClientEmptyState, ClientSkeleton } from "@/components/ui"
import { fetchGuideClientList } from "@/services/guide"
import { resolveRequestErrorMessage } from "@/services/http"
import type { GuideClientItem } from "@/types/guide"

const router = useRouter()
const items = shallowRef<GuideClientItem[]>([])
const pending = shallowRef(false)
const errorMessage = shallowRef("")

const loading = computed(() => pending.value && items.value.length === 0)
const failed = computed(() => Boolean(errorMessage.value) && items.value.length === 0)

async function refresh() {
  pending.value = true
  errorMessage.value = ""
  try {
    items.value = await fetchGuideClientList()
  } catch (error) {
    errorMessage.value = resolveRequestErrorMessage(error, "导游列表加载失败。")
  } finally {
    pending.value = false
  }
}

function openDetail(guide: GuideClientItem) {
  void router.push(`/shell/guides/${encodeURIComponent(guide.id)}`)
}

onMounted(() => {
  void refresh()
})
</script>

<template>
  <div class="client-surface">
    <div v-if="loading" class="space-y-3">
      <ClientSkeleton class="h-[4.5rem] w-full rounded-[1rem]" />
      <ClientSkeleton class="h-[4.5rem] w-full rounded-[1rem]" />
      <ClientSkeleton class="h-[4.5rem] w-full rounded-[1rem]" />
    </div>

    <template v-else-if="items.length">
      <p
        v-if="errorMessage"
        class="text-xs text-muted-foreground"
      >
        刷新失败，仍显示上次结果。
        <button
          type="button"
          class="text-primary underline-offset-2 hover:underline"
          @click="refresh"
        >
          重试
        </button>
      </p>

      <div class="guide-list">
        <button
          v-for="guide in items"
          :key="guide.id"
          type="button"
          class="guide-card"
          @click="openDetail(guide)"
        >
          <div class="guide-card__avatar">
            <img
              v-if="guide.avatarUrl"
              :src="guide.avatarUrl"
              :alt="guide.name"
              loading="lazy"
            >
            <UserRound
              v-else
              class="h-6 w-6 text-[var(--gold)] opacity-80"
              :stroke-width="1.6"
            />
          </div>
          <div class="guide-card__body">
            <h3 class="guide-card__name font-display">
              {{ guide.name }}
            </h3>
            <div
              v-if="guide.tags.length"
              class="guide-card__tags"
            >
              <span
                v-for="tag in guide.tags"
                :key="tag.id"
                class="guide-tag"
                :style="tag.color ? { borderColor: tag.color, color: tag.color } : undefined"
              >
                {{ tag.name }}
              </span>
            </div>
            <p
              v-else
              class="guide-card__empty-tags"
            >
              暂无标签
            </p>
          </div>
          <ChevronRight
            class="guide-card__chevron h-4 w-4 shrink-0"
            :stroke-width="1.8"
          />
        </button>
      </div>
    </template>

    <ClientEmptyState
      v-else
      :title="failed ? '加载失败' : '暂无导游'"
      :description="
        failed
          ? errorMessage || '请检查网络后重试。'
          : '馆内暂未配置可展示的导游。'
      "
      :action-text="failed ? '重新加载' : undefined"
      @action="failed ? refresh() : undefined"
    />
  </div>
</template>

<style scoped>
.guide-list {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}

.guide-card {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  width: 100%;
  padding: 0.85rem 0.9rem;
  border-radius: 1rem;
  border: 1px solid rgba(255, 248, 230, 0.08);
  background: rgba(12, 10, 8, 0.42);
  text-align: left;
  color: inherit;
  transition: border-color 0.18s ease, background 0.18s ease;
}

.guide-card:active {
  border-color: rgba(209, 178, 111, 0.35);
  background: rgba(209, 178, 111, 0.08);
}

.guide-card__avatar {
  display: flex;
  height: 3.1rem;
  width: 3.1rem;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-radius: 999px;
  border: 1px solid rgba(209, 178, 111, 0.28);
  background: rgba(209, 178, 111, 0.08);
}

.guide-card__avatar img {
  height: 100%;
  width: 100%;
  object-fit: cover;
}

.guide-card__body {
  min-width: 0;
  flex: 1;
}

.guide-card__name {
  margin: 0;
  font-size: 1.05rem;
  line-height: 1.25;
  color: var(--fg);
}

.guide-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-top: 0.45rem;
}

.guide-tag {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  border: 1px solid rgba(209, 178, 111, 0.32);
  background: rgba(209, 178, 111, 0.08);
  padding: 0.12rem 0.5rem;
  font-size: 0.68rem;
  line-height: 1.3;
  color: var(--gold-bright);
}

.guide-card__empty-tags {
  margin: 0.35rem 0 0;
  font-size: 0.72rem;
  color: var(--fg-dim);
}

.guide-card__chevron {
  color: var(--fg-dim);
  opacity: 0.7;
}
</style>
