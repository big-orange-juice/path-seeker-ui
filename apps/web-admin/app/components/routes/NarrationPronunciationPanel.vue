<script setup lang="ts">
import { reactive, shallowRef, watch } from 'vue'
import Button from '@/components/shadcn/button/Button.vue'
import Dialog from '@/components/shadcn/dialog/Dialog.vue'
import DialogContent from '@/components/shadcn/dialog/DialogContent.vue'
import DialogFooter from '@/components/shadcn/dialog/DialogFooter.vue'
import DialogHeader from '@/components/shadcn/dialog/DialogHeader.vue'
import DialogTitle from '@/components/shadcn/dialog/DialogTitle.vue'
import Input from '@/components/shadcn/input/Input.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import type { NarrationDetailResponse, NarrationNodePronunciationResponse } from '@/types/narration'

const props = withDefaults(defineProps<{
  detail: NarrationDetailResponse | null
  stageId?: string | null
  canEdit?: boolean
  refreshing?: boolean
}>(), {
  refreshing: false,
  stageId: '',
  canEdit: true,
})

const emit = defineEmits<{
  refresh: []
}>()
const { request } = useApiClient()
const nodePronunciations = shallowRef<NarrationNodePronunciationResponse[]>([])
const nodeLoading = shallowRef(false)
const isExpanded = shallowRef(false)
const editorOpen = shallowRef(false)
const editorSaving = shallowRef(false)
const editingPhrase = shallowRef('')
const editor = reactive({ phrase: '', pronunciation: '' })
let requestVersion = 0

const loadNodePronunciations = async () => {
  const currentVersion = ++requestVersion
  const stageId = String(props.stageId || props.detail?.stageId || '').trim()
  if (!stageId) { nodePronunciations.value = []; return }
  nodeLoading.value = true
  try {
    const result = await request<NarrationNodePronunciationResponse[]>('/api/narration/pronunciations', { query: { stageId } })
    if (currentVersion === requestVersion) nodePronunciations.value = result
  }
  catch { if (currentVersion === requestVersion) nodePronunciations.value = [] }
  finally { if (currentVersion === requestVersion) nodeLoading.value = false }
}

watch(() => [props.stageId, props.detail?.stageId] as const, () => { isExpanded.value = false })
watch(() => [props.stageId, props.detail?.stageId, props.detail?.pronunciationGeneratedAt] as const, () => void loadNodePronunciations(), { immediate: true })
const openCreate = () => { editingPhrase.value = ''; editor.phrase = ''; editor.pronunciation = ''; editorOpen.value = true }
const openEdit = (item: NarrationNodePronunciationResponse) => { editingPhrase.value = String(item.phrase || ''); editor.phrase = editingPhrase.value; editor.pronunciation = String(item.pronunciation || ''); editorOpen.value = true }
const saveNodePronunciation = async () => {
  const stageId = String(props.stageId || props.detail?.stageId || '').trim()
  const phrase = editor.phrase.trim(); const pronunciation = editor.pronunciation.trim()
  if (!stageId || !phrase || !pronunciation) return
  editorSaving.value = true
  try {
    await request('/api/narration/pronunciations', { method: editingPhrase.value ? 'PUT' : 'POST', body: editingPhrase.value ? { stageId, originalPhrase: editingPhrase.value, phrase, pronunciation } : { stageId, phrase, pronunciation } })
    editorOpen.value = false; await loadNodePronunciations(); emit('refresh')
  } finally { editorSaving.value = false }
}
const removeNodePronunciation = async (item: NarrationNodePronunciationResponse) => {
  const stageId = String(props.stageId || props.detail?.stageId || '').trim(); const phrase = String(item.phrase || '').trim()
  if (!stageId || !phrase || !window.confirm(`确定删除“${phrase}”的节点发音吗？`)) return
  await request('/api/narration/pronunciations', { method: 'DELETE', body: { stageId, phrase } }); await loadNodePronunciations(); emit('refresh')
}
</script>

<template>
  <section class="space-y-3 border-t border-border/60 pt-5">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <button
        type="button"
        class="flex min-w-0 items-center gap-2 text-left"
        :aria-expanded="isExpanded"
        aria-controls="narration-pronunciation-list"
        @click="isExpanded = !isExpanded">
        <AppIcon :name="isExpanded ? 'arrow-down' : 'arrow-right'" class="h-3.5 w-3.5 text-muted-foreground" />
        <span class="text-sm font-medium">关联多音字</span>
        <span v-if="nodePronunciations.length" class="text-xs text-muted-foreground">
          {{ nodePronunciations.length }} 条
        </span>
      </button>
      <div class="flex items-center gap-2">
        <Button
          variant="ghost"
          type="button"
          size="sm"
          class="h-7 px-2 text-xs"
          :disabled="props.refreshing"
          @click="emit('refresh')">
          <AppIcon
            name="refresh-cw"
            class="mr-1 h-3.5 w-3.5"
            :class="props.refreshing ? 'animate-spin' : ''" />
          刷新
        </Button>
        <Button v-if="props.canEdit" size="sm" class="h-7 px-2 text-xs" @click="openCreate">新增多音字</Button>
      </div>
    </div>

    <div v-if="isExpanded" id="narration-pronunciation-list" class="space-y-2">
      <p class="text-xs text-muted-foreground">节点级词条{{ nodeLoading ? '（加载中）' : '' }}</p>
      <div v-if="nodePronunciations.length" class="grid gap-2 sm:grid-cols-2">
        <article v-for="item in nodePronunciations" :key="item.phrase" class="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2.5">
          <div class="flex items-start justify-between gap-3"><div><p class="text-sm font-medium">{{ item.phrase }}</p><p class="font-mono text-xs text-primary">{{ item.pronunciation }}</p></div><div v-if="props.canEdit" class="flex gap-1"><Button size="sm" variant="ghost" class="h-7 px-2 text-xs" @click="openEdit(item)">编辑</Button><Button size="sm" variant="ghost" class="h-7 px-2 text-xs text-destructive" @click="removeNodePronunciation(item)">删除</Button></div></div>
        </article>
      </div>
      <p v-if="!nodeLoading && !nodePronunciations.length" class="rounded-lg border border-border/60 px-3 py-3 text-xs text-muted-foreground">
        当前节点暂无多音字词条。
      </p>
    </div>

    <Dialog v-model:open="editorOpen"><DialogContent class="max-w-[min(94vw,30rem)] rounded-xl border border-border bg-[#15171b] p-0 text-left"><DialogHeader class="px-5 pb-2 pt-4"><DialogTitle>{{ editingPhrase ? '编辑节点多音字' : '新增节点多音字' }}</DialogTitle></DialogHeader><form class="grid gap-4 px-5 py-3" @submit.prevent="saveNodePronunciation"><div class="space-y-1.5"><label class="text-sm font-medium">词语</label><Input v-model="editor.phrase" maxlength="128" placeholder="例如：越王勾践" /></div><div class="space-y-1.5"><label class="text-sm font-medium">拼音</label><Input v-model="editor.pronunciation" maxlength="512" placeholder="(yue4)(wang2)" /></div><DialogFooter><Button variant="outline" type="button" @click="editorOpen = false">取消</Button><Button type="submit" :disabled="editorSaving || !editor.phrase.trim() || !editor.pronunciation.trim()">保存</Button></DialogFooter></form></DialogContent></Dialog>
  </section>
</template>
