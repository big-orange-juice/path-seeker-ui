<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import Button from '@/components/shadcn/button/Button.vue'
import Dialog from '@/components/shadcn/dialog/Dialog.vue'
import DialogContent from '@/components/shadcn/dialog/DialogContent.vue'
import DialogFooter from '@/components/shadcn/dialog/DialogFooter.vue'
import DialogHeader from '@/components/shadcn/dialog/DialogHeader.vue'
import DialogTitle from '@/components/shadcn/dialog/DialogTitle.vue'
import Input from '@/components/shadcn/input/Input.vue'
import { useApiClient } from '@/composables/useApiClient'

/** 导游标签固定归在 category=4 */
const GUIDE_TAG_CATEGORY = 4

interface Tag {
  id?: string | null
  tagCode?: string | null
  name?: string | null
  color?: string | null
  description?: string | null
  sortOrder?: number
  status?: number
}

const props = defineProps<{ open: boolean, modelValue: string[] }>()

const emit = defineEmits<{
  'update:open': [boolean]
  'update:modelValue': [string[]]
  /** 回传选中标签的 id/name，供表单回显名称 */
  'update:tags': [Array<{ id: string, name: string }>]
}>()

const { request } = useApiClient()

const items = shallowRef<Tag[]>([])
const selected = shallowRef<string[]>([])
const name = shallowRef('')
const editing = shallowRef<Tag | null>(null)
const loading = shallowRef(false)
const saving = shallowRef(false)
const errorText = shallowRef('')

const isOpen = computed({
  get: () => props.open,
  set: (value: boolean) => emit('update:open', value),
})

const canSave = computed(() => Boolean(name.value.trim()) && !saving.value)

const load = async () => {
  loading.value = true
  errorText.value = ''
  try {
    const result = await request<Tag[]>('/api/tag/list', {
      query: { category: GUIDE_TAG_CATEGORY },
    })
    items.value = Array.isArray(result) ? result : []
  } catch (error) {
    errorText.value = error instanceof Error && error.message
      ? error.message
      : '标签加载失败。'
    items.value = []
  } finally {
    loading.value = false
  }
}

watch(
  () => props.open,
  (open) => {
    if (!open) {
      return
    }
    selected.value = [...(props.modelValue ?? [])]
    name.value = ''
    editing.value = null
    errorText.value = ''
    void load()
  },
)

const toggle = (id: string) => {
  selected.value = selected.value.includes(id)
    ? selected.value.filter((item) => item !== id)
    : [...selected.value, id]
}

const startEdit = (tag: Tag) => {
  editing.value = tag
  name.value = String(tag.name || '')
}

const cancelEdit = () => {
  editing.value = null
  name.value = ''
}

const save = async () => {
  const text = name.value.trim()
  if (!text || saving.value) {
    return
  }

  const tag = editing.value
  const tagId = String(tag?.id || '').trim()
  saving.value = true
  errorText.value = ''

  try {
    await request(tagId ? '/api/tag/update' : '/api/tag/create', {
      method: 'POST',
      body: {
        ...(tagId
          ? { id: tagId, tagCode: String(tag?.tagCode || text) }
          : { tagCode: `guide-${Date.now()}` }),
        name: text,
        category: GUIDE_TAG_CATEGORY,
        color: tag?.color || null,
        description: tag?.description || null,
        sortOrder: tag?.sortOrder || 0,
        status: tag?.status || 1,
      },
    })
    name.value = ''
    editing.value = null
    await load()
  } catch (error) {
    errorText.value = error instanceof Error && error.message
      ? error.message
      : '标签保存失败。'
  } finally {
    saving.value = false
  }
}

const remove = async (tag: Tag) => {
  const tagId = String(tag.id || '').trim()
  if (!tagId || !window.confirm(`删除标签「${tag.name || ''}」？`)) {
    return
  }

  errorText.value = ''
  try {
    await request('/api/tag/delete', { method: 'POST', body: { id: tagId } })
    selected.value = selected.value.filter((id) => id !== tagId)
    if (String(editing.value?.id || '') === tagId) {
      cancelEdit()
    }
    await load()
  } catch (error) {
    errorText.value = error instanceof Error && error.message
      ? error.message
      : '标签删除失败。'
  }
}

const confirm = () => {
  const ids = [...selected.value]
  emit('update:modelValue', ids)
  emit(
    'update:tags',
    items.value
      .map((item) => ({ id: String(item.id || ''), name: String(item.name || '') }))
      .filter((item) => item.id && ids.includes(item.id)),
  )
  isOpen.value = false
}
</script>

<template>
  <Dialog v-model:open="isOpen">
    <DialogContent class="flex h-[78vh] max-w-[min(92vw,34rem)] flex-col rounded-xl p-0">
      <DialogHeader class="shrink-0 border-b border-border/60 px-5 py-4">
        <DialogTitle>导游标签</DialogTitle>
      </DialogHeader>

      <div class="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
        <div class="flex gap-2">
          <Input
            v-model="name"
            :placeholder="editing ? '修改标签名称' : '新增标签名称'"
            @keydown.enter.prevent="save"
          />
          <Button size="sm" class="shrink-0" :disabled="!canSave" @click="save">
            {{ editing ? '保存' : '新增' }}
          </Button>
          <Button
            v-if="editing"
            variant="outline"
            size="sm"
            class="shrink-0"
            @click="cancelEdit"
          >
            取消
          </Button>
        </div>

        <p v-if="errorText" class="text-xs text-rose-300">
          {{ errorText }}
        </p>

        <div
          v-for="tag in items"
          :key="String(tag.id)"
          class="flex items-center gap-2 rounded-md border px-3 py-2"
          :class="selected.includes(String(tag.id)) ? 'border-primary bg-primary/10' : 'border-border'"
        >
          <button
            type="button"
            class="flex min-w-0 flex-1 items-center gap-2 text-left"
            :aria-pressed="selected.includes(String(tag.id))"
            @click="tag.id && toggle(String(tag.id))"
          >
            <span
              class="h-2 w-2 shrink-0 rounded-full"
              :style="{ backgroundColor: tag.color || '#d1b26f' }"
            />
            <span class="min-w-0 flex-1 truncate text-sm">{{ tag.name }}</span>
          </button>
          <span class="flex shrink-0 gap-2 text-xs text-muted-foreground">
            <button type="button" class="hover:text-foreground" @click="startEdit(tag)">
              编辑
            </button>
            <button type="button" class="hover:text-foreground" @click="remove(tag)">
              删除
            </button>
          </span>
        </div>

        <p v-if="loading" class="text-sm text-muted-foreground">
          标签加载中…
        </p>
        <p v-else-if="!items.length" class="text-sm text-muted-foreground">
          暂无导游标签，可直接新增。
        </p>
      </div>

      <DialogFooter class="shrink-0 border-t border-border/60 px-5 py-3">
        <Button variant="outline" @click="isOpen = false">
          取消
        </Button>
        <Button @click="confirm">
          确定
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
