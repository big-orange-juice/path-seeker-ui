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

/** 视觉权重档：越靠前越大，无名次数字 */
function weightTone(index: number): "lead" | "mid" | "soft" {
  if (index === 0) return "lead"
  if (index === 1 || index === 2) return "mid"
  return "soft"
}

onMounted(() => {
  void refresh()
})
</script>

<template>
  <div class="client-surface guides-page">
    <div v-if="loading" class="guide-stack">
      <ClientSkeleton class="h-[7.5rem] w-full rounded-[1.25rem]" />
      <ClientSkeleton class="h-[6.2rem] w-full rounded-[1.15rem]" />
      <ClientSkeleton class="h-[5.4rem] w-full rounded-[1.05rem]" />
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

      <!-- 去排名：无序号/奖牌，仅视觉自高向低收敛 -->
      <div class="guide-stack">
        <button
          v-for="(guide, index) in items"
          :key="guide.id"
          type="button"
          class="guide-plate"
          :class="`is-${weightTone(index)}`"
          @click="openDetail(guide)"
        >
          <div class="guide-plate__avatar">
            <img
              v-if="guide.avatarUrl"
              :src="guide.avatarUrl"
              :alt="guide.name"
              loading="lazy"
            >
            <UserRound
              v-else
              class="guide-plate__avatar-icon"
              :stroke-width="1.5"
            />
          </div>
          <div class="guide-plate__body">
            <h3 class="guide-plate__name font-display">
              {{ guide.name }}
            </h3>
            <p
              v-if="guide.description"
              class="guide-plate__desc"
            >
              {{ guide.description }}
            </p>
            <div
              v-if="guide.tags.length"
              class="guide-plate__tags"
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
              v-else-if="!guide.description"
              class="guide-plate__empty"
            >
              暂无简介
            </p>
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
  gap: 0.85rem;
}

.guide-stack {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

/* 展墙式人物卡：自上而下视觉权重递减，无名次 */
.guide-plate {
  display: flex;
  align-items: flex-start;
  gap: 0.95rem;
  width: 100%;
  border: 1px solid rgba(255, 248, 230, 0.08);
  border-radius: 1.2rem;
  background:
    linear-gradient(
      145deg,
      rgba(209, 178, 111, 0.1) 0%,
      rgba(12, 10, 8, 0.5) 42%,
      rgba(12, 10, 8, 0.38) 100%
    );
  text-align: left;
  color: inherit;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.22);
}

.guide-plate:active {
  border-color: rgba(209, 178, 111, 0.34);
}

.guide-plate.is-lead {
  padding: 1.15rem 1.05rem;
  border-color: rgba(209, 178, 111, 0.28);
  box-shadow:
    0 14px 36px rgba(0, 0, 0, 0.28),
    0 0 0 1px rgba(209, 178, 111, 0.08);
}

.guide-plate.is-mid {
  padding: 0.95rem 0.95rem;
  opacity: 0.96;
}

.guide-plate.is-soft {
  padding: 0.8rem 0.9rem;
  opacity: 0.9;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.16);
  background: rgba(12, 10, 8, 0.42);
}

.guide-plate__avatar {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-radius: 999px;
  border: 1px solid rgba(209, 178, 111, 0.3);
  background: rgba(209, 178, 111, 0.08);
}

.guide-plate.is-lead .guide-plate__avatar {
  height: 4.4rem;
  width: 4.4rem;
}

.guide-plate.is-mid .guide-plate__avatar {
  height: 3.5rem;
  width: 3.5rem;
}

.guide-plate.is-soft .guide-plate__avatar {
  height: 3rem;
  width: 3rem;
}

.guide-plate__avatar img {
  height: 100%;
  width: 100%;
  object-fit: cover;
}

.guide-plate__avatar-icon {
  color: var(--gold);
  opacity: 0.85;
}

.guide-plate.is-lead .guide-plate__avatar-icon {
  height: 1.85rem;
  width: 1.85rem;
}

.guide-plate.is-mid .guide-plate__avatar-icon,
.guide-plate.is-soft .guide-plate__avatar-icon {
  height: 1.35rem;
  width: 1.35rem;
}

.guide-plate__body {
  min-width: 0;
  flex: 1;
  padding-top: 0.1rem;
}

.guide-plate__name {
  margin: 0;
  line-height: 1.2;
  color: var(--fg);
}

.guide-plate.is-lead .guide-plate__name {
  font-size: 1.28rem;
}

.guide-plate.is-mid .guide-plate__name {
  font-size: 1.08rem;
}

.guide-plate.is-soft .guide-plate__name {
  font-size: 0.98rem;
}

.guide-plate__desc {
  display: -webkit-box;
  margin: 0.4rem 0 0;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  color: var(--fg-dim);
  font-size: 0.78rem;
  line-height: 1.5;
}

.guide-plate.is-soft .guide-plate__desc {
  -webkit-line-clamp: 1;
  font-size: 0.72rem;
}

.guide-plate__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.32rem;
  margin-top: 0.5rem;
}

.guide-tag {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  border: 1px solid rgba(209, 178, 111, 0.32);
  background: rgba(209, 178, 111, 0.08);
  padding: 0.1rem 0.48rem;
  font-size: 0.66rem;
  line-height: 1.3;
  color: var(--gold-bright);
}

.guide-plate__empty {
  margin: 0.35rem 0 0;
  font-size: 0.72rem;
  color: var(--fg-dim);
}
</style>
