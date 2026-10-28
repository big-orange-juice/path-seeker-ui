<script setup lang="ts">
import { reactive, shallowRef, watch } from 'vue'
import Button from '@/components/shadcn/button/Button.vue'
import Input from '@/components/shadcn/input/Input.vue'
import Textarea from '@/components/shadcn/textarea/Textarea.vue'
import Dialog from '@/components/shadcn/dialog/Dialog.vue'
import DialogContent from '@/components/shadcn/dialog/DialogContent.vue'
import DialogHeader from '@/components/shadcn/dialog/DialogHeader.vue'
import DialogTitle from '@/components/shadcn/dialog/DialogTitle.vue'
import DialogDescription from '@/components/shadcn/dialog/DialogDescription.vue'
import type { PostcardTemplate } from '@/types/postcard'

const props = defineProps<{ open: boolean; template: PostcardTemplate | null }>()
const emit = defineEmits<{ 'update:open': [value: boolean]; saved: [] }>()
const { request } = useApiClient()
const draft = reactive({ name: '', mode: 'html', html: '', prompt: '', width: 1080, height: 1440, enabled: true })
const busy = shallowRef(false)
const error = shallowRef('')
const basic = '<div style="height:100%;padding:64px;background:#f4f7ef;color:#244e46;font-family:sans-serif;display:flex;flex-direction:column;gap:24px"><div style="font-size:24px;letter-spacing:6px">PATH SEEKER · 寻迹</div><img src="{{imageUrl}}" style="width:100%;height:760px;object-fit:cover;border-radius:12px"><h1 style="font-size:66px;margin:0">{{stageTitle}}</h1><p style="font-size:34px;line-height:1.6;margin:0">{{caption}}</p><div style="margin-top:auto;border-top:2px solid #b8ccbe;padding-top:24px;font-size:24px">{{routeTitle}} · {{date}}</div></div>'
watch(() => props.open, open => { if (open) { Object.assign(draft, props.template || { name: '', mode: 'html', html: basic, prompt: '', width: 1080, height: 1440, enabled: true }); error.value = '' } })
async function save() {
  if (busy.value) return
  busy.value = true; error.value = ''
  try { await request('/api/postcards/save-template', { method: 'POST', body: { ...draft, id: props.template?.id || null, expectedVersion: props.template?.version ?? null } }); emit('saved'); emit('update:open', false) }
  catch (e) { error.value = e instanceof Error ? e.message : '模板保存失败' }
  finally { busy.value = false }
}
</script>

<template>
  <Dialog :open="open" @update:open="!busy && emit('update:open', Boolean($event))"><DialogContent class="max-w-3xl rounded-xl"><DialogHeader><DialogTitle>{{ template ? '编辑明信片模板' : '新增明信片模板' }}</DialogTitle><DialogDescription>维护版式、图片风格和使用状态。</DialogDescription></DialogHeader>
    <form class="grid gap-3" @submit.prevent="save">
      <div class="grid grid-cols-2 gap-3"><label class="space-y-1 text-sm">名称<Input v-model="draft.name" required maxlength="80" /></label><label class="space-y-1 text-sm">生成方式<select v-model="draft.mode" class="h-9 w-full rounded-md border bg-background px-3"><option value="html">普通明信片</option><option value="ai">终点图生图</option></select></label></div>
      <div class="grid grid-cols-2 gap-3"><label class="text-sm">宽度<input v-model.number="draft.width" type="number" min="480" max="1600" class="h-9 w-full rounded-md border bg-background px-3"></label><label class="text-sm">高度<input v-model.number="draft.height" type="number" min="480" max="2000" class="h-9 w-full rounded-md border bg-background px-3"></label></div>
      <label class="space-y-1 text-sm">版式内容<Textarea v-model="draft.html" required rows="9" class="font-mono text-xs" /></label>
      <p class="text-xs text-muted-foreground" v-pre>可用内容：{{stageTitle}} 景点、{{routeTitle}} 路线、{{caption}} 寄语、{{date}} 日期、{{imageUrl}} 图片。</p>
      <label v-if="draft.mode === 'ai'" class="space-y-1 text-sm">图片风格描述<Textarea v-model="draft.prompt" required rows="3" maxlength="4000" placeholder="描述照片的画面风格和希望保留的主体特征" /></label>
      <label class="flex items-center gap-2 text-sm"><input v-model="draft.enabled" type="checkbox">启用模板</label><p v-if="error" class="text-sm text-destructive" role="alert">{{ error }}</p>
      <div class="flex justify-end gap-2"><Button type="button" variant="outline" :disabled="busy" @click="emit('update:open', false)">取消</Button><Button type="submit" :disabled="busy">{{ busy ? '保存中…' : '保存模板' }}</Button></div>
    </form>
  </DialogContent></Dialog>
</template>

