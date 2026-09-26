<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { ChevronDown, ChevronUp, ImagePlus, X } from 'lucide-vue-next'
import { createStageImage } from '../data/mock'
import type { CollectionItem, Destination, PublishStatus } from '../types'
import { cloneValue } from '../utils'

interface Props {
  open: boolean
  mode: 'create' | 'edit'
  initialValue: CollectionItem
  destinations: Destination[]
}
const props = defineProps<Props>()
const emit = defineEmits<{ 'update:open': [value: boolean]; save: [value: CollectionItem] }>()

const form = ref<CollectionItem>(cloneValue(props.initialValue))
const showMore = ref(false)
const error = ref('')

const dialogTitle = computed(() => props.mode === 'create' ? '新增内容' : '编辑内容')
const dialogDescription = computed(() => '维护内容基础信息、归属景点与发布状态。')
const destinationOptions = computed(() => props.destinations)
const selectedDestination = computed(() => props.destinations.find(item => item.id === form.value.destinationId) ?? null)
const kindLabel = computed(() => form.value.kind === 'relic' ? '文物' : '文化点')
const locationLabel = computed(() => form.value.kind === 'relic' ? '展陈位置' : '到访地址')
const locationPlaceholder = computed(() => form.value.kind === 'relic' ? '如 城市记忆厅 · 展柜 A-03' : '如 后海北沿 46 号')
const dirty = computed(() => JSON.stringify(form.value) !== JSON.stringify(props.initialValue))

watch(() => props.initialValue, value => { form.value = cloneValue(value); error.value = '' }, { deep: true })
onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))
function onKey(event: KeyboardEvent) { if (event.key === 'Escape') requestClose() }

/** 新增时按“文物 / 文化点”给一个可读的编码建议，运营可覆盖。 */
function suggestCode() {
  if (props.mode !== 'create' || form.value.code) return
  const prefix = form.value.kind === 'relic' ? 'COL' : 'PLACE'
  const sequence = String(Math.floor(Math.random() * 900) + 100)
  form.value.code = `${prefix}-${new Date().getFullYear()}-${sequence}`
}
function pickImage() {
  const index = form.value.imageUrl ? 2 : 1
  form.value.imageUrl = createStageImage(`${form.value.id}-img-${Date.now()}`, `${form.value.name || '新内容'} · 主图 ${index}`, form.value.name.slice(0, 4) || '内容', 36).url
}
function requestClose() {
  if (dirty.value && !window.confirm('放弃未保存的修改？')) return
  emit('update:open', false)
}
function submit() {
  const name = form.value.name.trim()
  if (!name) { error.value = '请填写内容名称'; return }
  if (!form.value.destinationId) { error.value = '请选择所属景点'; return }
  error.value = ''
  suggestCode()
  form.value.name = name
  form.value.code = form.value.code.trim() || `COL-${Date.now()}`
  emit('save', cloneValue(form.value))
  emit('update:open', false)
}
</script>

<template>
  <div v-if="open" class="form-modal" @click.self="requestClose">
    <section class="form-dialog" role="dialog" :aria-label="dialogTitle">
      <header class="form-dialog-head">
        <div><span class="eyebrow">{{ mode === 'create' ? '内容' : '内容 · 编辑' }}</span><h3>{{ dialogTitle }}</h3><p>{{ dialogDescription }}</p></div>
        <button class="icon-button" aria-label="关闭" @click="requestClose"><X :size="18" /></button>
      </header>

      <div class="form-dialog-body">
        <div class="form-row">
          <label class="stage-field">内容名称<input v-model="form.name" placeholder="请输入内容名称" @focus="suggestCode" /></label>
          <label class="stage-field">所属景点<select v-model="form.destinationId"><option value="">请选择</option><option v-for="item in destinationOptions" :key="item.id" :value="item.id">{{ item.name }}</option></select></label>
        </div>

        <div class="form-row">
          <label class="stage-field">内容类型<select v-model="form.kind"><option value="relic">文物</option><option value="place">文化点</option></select></label>
          <label class="stage-field">分类<input v-model="form.category" placeholder="如 青铜器 / 历史街巷" /></label>
        </div>

        <div class="form-row">
          <label class="stage-field">年代 / 朝代<input v-model="form.era" placeholder="如 商周 / 明代" /></label>
          <label class="stage-field">材质<input v-model="form.material" placeholder="如 青铜 / 石构" /></label>
        </div>

        <div class="form-row">
          <label class="stage-field">建议停留（分钟）<input v-model.number="form.recommendedMinutes" type="number" min="1" step="1" placeholder="分钟" /></label>
          <label class="stage-field">发布状态<select v-model="form.status"><option value="draft">草稿</option><option value="pending">待审核</option><option :value="'published' as PublishStatus">已发布</option></select></label>
        </div>

        <label class="stage-field">{{ locationLabel }}<input v-model="form.location" :placeholder="locationPlaceholder" /></label>

        <label class="stage-field">内容简介<textarea v-model="form.description" rows="4" placeholder="输入内容背景、工艺特征或讲解摘要" /></label>

        <div class="form-media">
          <figure v-if="form.imageUrl"><img :src="form.imageUrl" alt="内容主图" /><button aria-label="移除主图" @click="form.imageUrl = null"><X :size="12" /></button></figure>
          <button class="mini-button gold" @click="pickImage"><ImagePlus :size="12" />{{ form.imageUrl ? '更换主图' : '上传主图' }}</button>
          <span class="stage-hint">主图用于列表预览与 C 端站点卡片；Demo 中使用本地占位图。</span>
        </div>

        <section class="form-more">
          <button type="button" class="form-more-toggle" @click="showMore = !showMore"><span>更多资料</span><span><template v-if="showMore">收起<ChevronUp :size="13" /></template><template v-else>展开<ChevronDown :size="13" /></template></span></button>
          <div v-if="showMore" class="form-row">
            <label class="stage-field">内容编码<input v-model="form.code" placeholder="如 COL-2026-003" /></label>
            <label class="stage-field">讲解版本<em class="form-static">{{ form.guideVersions }} 版 · 在“导游管理”中维护</em></label>
          </div>
        </section>

        <p v-if="selectedDestination" class="stage-hint">所属景点：{{ selectedDestination.name }} · {{ selectedDestination.sceneType === 'outdoor' ? '户外漫游' : '场馆探索' }} · 内容类型 {{ kindLabel }}</p>
      </div>

      <footer class="form-dialog-foot">
        <p v-if="error" class="stage-error" role="alert">{{ error }}</p>
        <button class="button ghost" @click="requestClose">取消</button>
        <button class="button primary" @click="submit">保存</button>
      </footer>
    </section>
  </div>
</template>
