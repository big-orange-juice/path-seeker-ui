<script setup lang="ts">
import { computed, onMounted, shallowRef } from "vue"
import { useRouter } from "vue-router"
import { UserRound } from "lucide-vue-next"
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

function tagSlice(guide: GuideClientItem, max = 2) {
  return (guide.tags || []).slice(0, max)
}

function routeCountLabel(count: number) {
  if (count <= 0) return "暂无路线"
  return `${count} 条路线`
}

onMounted(() => {
  void refresh()
})
</script>

<template>
  <div class="client-surface guides-page">
    <div v-if="loading" class="guide-stack">
      <ClientSkeleton
        v-for="n in 5"
        :key="n"
        class="h-[4.4rem] w-full rounded-[1rem]"
      />
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

      <!--
        紧凑横排人物条：一屏多条，仍用展签/金边气质，避免大立像占屏。
      -->
      <div class="guide-stack">
        <button
          v-for="guide in items"
          :key="guide.id"
          type="button"
          class="guide-row"
          @click="openDetail(guide)"
        >
          <div class="guide-row__avatar">
            <img
              v-if="guide.avatarUrl"
              :src="guide.avatarUrl"
              :alt="guide.name"
              loading="lazy"
            >
            <UserRound
              v-else
              class="guide-row__avatar-icon"
              :stroke-width="1.5"
            />
          </div>

          <div class="guide-row__body">
            <div class="guide-row__top">
              <h3 class="guide-row__name font-display">
                {{ guide.name }}
              </h3>
              <span
                class="guide-row__count"
                :class="{ 'is-empty': guide.routeCount <= 0 }"
              >
                {{ routeCountLabel(guide.routeCount) }}
              </span>
            </div>

            <p
              v-if="guide.voiceStyle"
              class="guide-row__voice"
            >
              {{ guide.voiceStyle }}
            </p>

            <div
              v-if="tagSlice(guide).length"
              class="guide-row__tags"
            >
              <span
                v-for="tag in tagSlice(guide)"
                :key="tag.id"
                class="guide-chip"
                :style="tag.color ? { borderColor: tag.color, color: tag.color } : undefined"
              >
                {{ tag.name }}
              </span>
            </div>
          </div>
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
.guides-page {
  gap: 0.7rem;
}

.guide-stack {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

/* 横排紧凑条：头像 + 身份，一屏可见多位 */
.guide-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  padding: 0.65rem 0.75rem;
  border: 1px solid rgba(255, 248, 230, 0.1);
  border-radius: 1rem;
  background:
    linear-gradient(
      120deg,
      rgba(209, 178, 111, 0.09) 0%,
      rgba(12, 10, 8, 0.48) 42%,
      rgba(12, 10, 8, 0.36) 100%
    );
  text-align: left;
  color: inherit;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.16);
}

.guide-row:active {
  border-color: rgba(209, 178, 111, 0.36);
}

.guide-row__avatar {
  display: flex;
  height: 3.15rem;
  width: 3.15rem;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-radius: 999px;
  border: 1px solid rgba(209, 178, 111, 0.32);
  background: rgba(209, 178, 111, 0.1);
}

.guide-row__avatar img {
  height: 100%;
  width: 100%;
  object-fit: cover;
  object-position: center 18%;
  filter: saturate(0.92) brightness(0.92) contrast(1.04);
}

.guide-row__avatar-icon {
  height: 1.25rem;
  width: 1.25rem;
  color: var(--gold);
  opacity: 0.85;
}

.guide-row__body {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.18rem;
}

.guide-row__top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
}

.guide-row__name {
  margin: 0;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--fg);
  font-size: 1rem;
  line-height: 1.2;
}

.guide-row__count {
  flex-shrink: 0;
  border-radius: 999px;
  border: 1px solid rgba(209, 178, 111, 0.34);
  background: rgba(209, 178, 111, 0.12);
  padding: 0.1rem 0.45rem;
  color: var(--gold-bright);
  font-size: 0.64rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  line-height: 1.25;
  white-space: nowrap;
}

.guide-row__count.is-empty {
  border-color: rgba(255, 248, 230, 0.12);
  background: rgba(12, 10, 8, 0.28);
  color: var(--fg-dim);
  font-weight: 500;
}

.guide-row__voice {
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--fg-dim);
  font-size: 0.72rem;
  font-style: italic;
  line-height: 1.35;
}

.guide-row__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  margin-top: 0.08rem;
}

.guide-chip {
  display: inline-flex;
  align-items: center;
  max-width: 6.5rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  border-radius: 999px;
  border: 1px solid rgba(209, 178, 111, 0.28);
  background: rgba(209, 178, 111, 0.08);
  padding: 0.06rem 0.4rem;
  color: var(--gold-bright);
  font-size: 0.62rem;
  line-height: 1.25;
}
</style>
