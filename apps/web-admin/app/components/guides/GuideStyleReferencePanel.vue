<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import { resolveApiErrorMessage, useApiClient } from '@/composables/useApiClient'
import { mapStyleReferenceFiles } from '@/composables/useGuideManagement'
import type { GuideStyleReferenceFile } from '@/types/guide'

interface Props {
  /** 导游主键（string 透传） */
  guideId: string | null
  /** 详情弹窗是否处于可加载状态 */
  active?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  active: true,
})

const { request } = useApiClient()

const files = shallowRef<GuideStyleReferenceFile[]>([])
const filesPending = shallowRef(false)
const filesError = shallowRef('')
const activeUrl = shallowRef('')

const contentByUrl = shallowRef<Record<string, string>>({})
const contentPending = shallowRef(false)
const contentError = shallowRef('')

/** 列表 / 正文请求序号，丢弃过期响应 */
let filesRequestSeq = 0
let contentRequestSeq = 0

const hasFiles = computed(() => files.value.length > 0)

const activeContent = computed(() => {
  const url = activeUrl.value
  if (!url) {
    return ''
  }
  return contentByUrl.value[url] ?? ''
})

const resetState = () => {
  filesRequestSeq += 1
  contentRequestSeq += 1
  files.value = []
  filesPending.value = false
  filesError.value = ''
  activeUrl.value = ''
  contentByUrl.value = {}
  contentPending.value = false
  contentError.value = ''
}

const loadFileContent = async (url: string) => {
  if (!url) {
    return
  }

  if (Object.prototype.hasOwnProperty.call(contentByUrl.value, url)) {
    contentError.value = ''
    contentPending.value = false
    return
  }

  const seq = ++contentRequestSeq
  contentPending.value = true
  contentError.value = ''

  try {
    const result = await request<{ text: string }>('/api/guide/style-reference-file-content', {
      query: { url },
    })
    if (seq !== contentRequestSeq || activeUrl.value !== url) {
      return
    }
    contentByUrl.value = {
      ...contentByUrl.value,
      [url]: typeof result?.text === 'string' ? result.text : '',
    }
  } catch (caughtError) {
    if (seq !== contentRequestSeq || activeUrl.value !== url) {
      return
    }
    contentError.value = resolveApiErrorMessage(caughtError, '风格参考文件读取失败。')
  } finally {
    if (seq === contentRequestSeq) {
      contentPending.value = false
    }
  }
}

const selectTab = (url: string) => {
  if (!url || activeUrl.value === url) {
    return
  }
  activeUrl.value = url
  contentError.value = ''
  void loadFileContent(url)
}

const loadFiles = async (guideId: string) => {
  const seq = ++filesRequestSeq
  contentRequestSeq += 1

  filesPending.value = true
  filesError.value = ''
  files.value = []
  activeUrl.value = ''
  contentByUrl.value = {}
  contentPending.value = false
  contentError.value = ''

  try {
    const list = await request<string[]>('/api/guide/style-reference-files', {
      query: { id: guideId },
    })
    if (seq !== filesRequestSeq) {
      return
    }

    const mapped = mapStyleReferenceFiles(list)
    files.value = mapped
    const first = mapped[0]
    if (first) {
      activeUrl.value = first.url
      void loadFileContent(first.url)
    }
  } catch (caughtError) {
    if (seq !== filesRequestSeq) {
      return
    }
    filesError.value = resolveApiErrorMessage(caughtError, '风格参考文件列表加载失败。')
  } finally {
    if (seq === filesRequestSeq) {
      filesPending.value = false
    }
  }
}

watch(
  () => [props.active, props.guideId] as const,
  ([active, guideId]) => {
    if (!active || !guideId) {
      resetState()
      return
    }
    void loadFiles(guideId)
  },
  { immediate: true },
)
</script>

<template>
  <div class="rounded-lg border border-border/50 bg-background/40">
    <div class="border-b border-border/50 px-3 py-2">
      <p class="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
        风格参考
      </p>
    </div>

    <div class="px-3 py-3">
      <p v-if="filesPending" class="text-sm text-muted-foreground">
        正在加载风格参考文件…
      </p>
      <p v-else-if="filesError" class="text-sm text-rose-200">
        {{ filesError }}
      </p>
      <p v-else-if="!hasFiles" class="text-sm text-muted-foreground">
        暂无风格参考文件。
      </p>
      <template v-else>
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="file in files"
            :key="file.url"
            type="button"
            class="max-w-full truncate rounded-md border px-2.5 py-1 text-xs transition-colors"
            :class="
              activeUrl === file.url
                ? 'border-primary/35 bg-primary/10 text-foreground'
                : 'border-border bg-secondary/30 text-muted-foreground hover:bg-secondary/45 hover:text-foreground'
            "
            :title="file.name"
            @click="selectTab(file.url)"
          >
            {{ file.name }}
          </button>
        </div>

        <div class="mt-3 min-h-[14rem] rounded-md border border-border/40 bg-[#101216] px-3 py-3">
          <p v-if="contentPending" class="text-sm text-muted-foreground">
            正在读取文件内容…
          </p>
          <p v-else-if="contentError" class="text-sm text-rose-200">
            {{ contentError }}
          </p>
          <div
            v-else-if="activeContent"
            class="guide-style-md max-h-[min(48vh,28rem)] overflow-auto text-sm leading-6 text-foreground/90"
          >
            <Comark :markdown="activeContent" />
          </div>
          <p v-else class="text-sm text-muted-foreground">（空文件）</p>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.guide-style-md :deep(:first-child) {
  margin-top: 0;
}

.guide-style-md :deep(:last-child) {
  margin-bottom: 0;
}

.guide-style-md :deep(p) {
  margin: 0.4em 0;
}

.guide-style-md :deep(h1),
.guide-style-md :deep(h2),
.guide-style-md :deep(h3),
.guide-style-md :deep(h4) {
  margin: 0.75em 0 0.35em;
  font-weight: 600;
  line-height: 1.35;
  color: hsl(var(--foreground));
}

.guide-style-md :deep(h1) {
  font-size: 1.05rem;
}

.guide-style-md :deep(h2) {
  font-size: 1rem;
}

.guide-style-md :deep(h3),
.guide-style-md :deep(h4) {
  font-size: 0.95rem;
}

.guide-style-md :deep(ul),
.guide-style-md :deep(ol) {
  margin: 0.4em 0;
  padding-left: 1.2rem;
}

.guide-style-md :deep(ul) {
  list-style: disc;
}

.guide-style-md :deep(ol) {
  list-style: decimal;
}

.guide-style-md :deep(li) {
  margin: 0.15em 0;
}

.guide-style-md :deep(blockquote) {
  margin: 0.5em 0;
  border-left: 2px solid rgba(209, 178, 111, 0.35);
  padding-left: 0.7rem;
  color: hsl(var(--muted-foreground));
}

.guide-style-md :deep(a) {
  color: hsl(var(--primary));
  text-decoration: underline;
  text-underline-offset: 2px;
  word-break: break-all;
}

.guide-style-md :deep(code) {
  border-radius: 0.3rem;
  background: rgba(209, 178, 111, 0.1);
  padding: 0.08em 0.32em;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.86em;
  color: #f0e2bc;
}

.guide-style-md :deep(pre) {
  margin: 0.55em 0;
  overflow-x: auto;
  border-radius: 0.5rem;
  border: 1px solid rgba(209, 178, 111, 0.12);
  background: rgba(8, 9, 11, 0.72);
  padding: 0.6rem 0.7rem;
}

.guide-style-md :deep(pre code) {
  display: block;
  padding: 0;
  background: transparent;
  font-size: 0.8em;
  line-height: 1.55;
  white-space: pre;
}

.guide-style-md :deep(hr) {
  margin: 0.75em 0;
  border: 0;
  border-top: 1px solid rgba(209, 178, 111, 0.14);
}

.guide-style-md :deep(table) {
  width: 100%;
  margin: 0.55em 0;
  border-collapse: collapse;
  font-size: 0.9em;
}

.guide-style-md :deep(th),
.guide-style-md :deep(td) {
  border: 1px solid rgba(255, 255, 255, 0.08);
  padding: 0.3rem 0.45rem;
  text-align: left;
}

.guide-style-md :deep(th) {
  background: rgba(209, 178, 111, 0.08);
  font-weight: 600;
}

.guide-style-md :deep(strong) {
  font-weight: 600;
  color: #f4e7c4;
}
</style>
