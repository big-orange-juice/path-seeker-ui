<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import Button from '@/components/shadcn/button/Button.vue'
import Dialog from '@/components/shadcn/dialog/Dialog.vue'
import DialogContent from '@/components/shadcn/dialog/DialogContent.vue'
import DialogFooter from '@/components/shadcn/dialog/DialogFooter.vue'
import DialogHeader from '@/components/shadcn/dialog/DialogHeader.vue'
import DialogTitle from '@/components/shadcn/dialog/DialogTitle.vue'
import Input from '@/components/shadcn/input/Input.vue'
import Select from '@/components/shadcn/select/Select.vue'
import Textarea from '@/components/shadcn/textarea/Textarea.vue'
import { PRONUNCIATION_PATTERN, type PronunciationEntry, type PronunciationEntryDraft } from '@/types/tts-pronunciation'

interface MuseumOption {
  label: string
  value: string
}

const props = withDefaults(defineProps<{
  open: boolean
  entry?: PronunciationEntry | null
  submitting?: boolean
  museumOptions?: MuseumOption[]
  museumPending?: boolean
}>(), {
  entry: null,
  submitting: false,
  museumOptions: () => [],
  museumPending: false,
})
const emit = defineEmits<{ 'update:open': [value: boolean]; submit: [draft: PronunciationEntryDraft] }>()

const form = reactive<PronunciationEntryDraft>({ scopeType: 1, museumId: '', phrase: '', pronunciation: '', category: '', priority: 0, remark: '' })

watch(() => [props.open, props.entry] as const, ([open, entry]) => {
  if (!open) return
  Object.assign(form, {
    scopeType: entry?.scopeType ?? 1,
    museumId: entry?.museumId ?? '',
    phrase: entry?.phrase ?? '',
    pronunciation: entry?.pronunciation ?? '',
    category: entry?.category ?? '',
    priority: entry?.priority ?? 0,
    remark: entry?.remark ?? '',
  })
}, { immediate: true })

const syllableCount = computed(() => form.pronunciation.match(/\([a-züv]+[1-5]\)/g)?.length ?? 0)
const chineseCount = computed(() => form.phrase.match(/[\u3400-\u9fff]/g)?.length ?? 0)
const pronunciationValid = computed(() => PRONUNCIATION_PATTERN.test(form.pronunciation.trim()))
const countValid = computed(() => chineseCount.value > 0 && chineseCount.value === syllableCount.value)
const canSubmit = computed(() => form.phrase.trim() && pronunciationValid.value && countValid.value && (form.scopeType !== 2 || form.museumId.trim()))
const availableMuseumOptions = computed(() => {
  if (!form.museumId || props.museumOptions.some((option) => option.value === form.museumId)) {
    return props.museumOptions
  }

  return [{ value: form.museumId, label: form.museumId }, ...props.museumOptions]
})
</script>

<template>
  <Dialog :open="props.open" @update:open="emit('update:open', Boolean($event))">
    <DialogContent class="max-w-[min(94vw,36rem)] rounded-xl border border-border bg-[#15171b] p-0 text-left">
      <DialogHeader class="px-5 pb-2 pt-4">
        <DialogTitle>{{ props.entry ? '编辑发音词条' : '新增发音词条' }}</DialogTitle>
      </DialogHeader>
      <form class="grid gap-4 px-5 py-3 sm:grid-cols-2" @submit.prevent="emit('submit', { ...form })">
        <div class="space-y-1.5">
          <label class="text-sm font-medium">作用域</label>
          <Select :model-value="String(form.scopeType)" :disabled="Boolean(props.entry)" @update:model-value="form.scopeType = Number($event)">
            <option value="1">全局</option><option value="2">博物馆</option>
          </Select>
        </div>
        <div class="space-y-1.5">
          <label class="text-sm font-medium">博物馆</label>
          <Select
            v-model="form.museumId"
            searchable
            search-placeholder="搜索博物馆"
            :disabled="form.scopeType !== 2 || Boolean(props.entry) || props.museumPending || !availableMuseumOptions.length"
            :placeholder="props.museumPending ? '正在加载...' : '请选择博物馆'"
            empty-text="暂无博物馆">
            <option v-for="option in availableMuseumOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </Select>
        </div>
        <div class="space-y-1.5">
          <label class="text-sm font-medium">词语</label>
          <Input v-model="form.phrase" placeholder="例如：礼乐" />
        </div>
        <div class="space-y-1.5">
          <label class="text-sm font-medium">拼音</label>
          <Input v-model="form.pronunciation" placeholder="(li3)(yue4)" />
          <p class="text-xs" :class="pronunciationValid && countValid ? 'text-emerald-300' : 'text-amber-300'">
            使用带声调数字的括号音节；中文 {{ chineseCount }} 字，拼音 {{ syllableCount }} 节
          </p>
        </div>
        <div class="space-y-1.5">
          <label class="text-sm font-medium">分类</label><Input v-model="form.category" placeholder="人名、地名、专名等" />
        </div>
        <div class="space-y-1.5">
          <label class="text-sm font-medium">优先级</label><Input :model-value="String(form.priority)" type="number" @update:model-value="form.priority = Number($event)" />
        </div>
        <div class="space-y-1.5 sm:col-span-2">
          <label class="text-sm font-medium">备注</label><Textarea v-model="form.remark" rows="3" placeholder="校对说明（可选）" />
        </div>
        <DialogFooter class="sm:col-span-2">
          <Button variant="outline" type="button" @click="emit('update:open', false)">取消</Button>
          <Button type="submit" :disabled="!canSubmit || props.submitting">保存草稿</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
