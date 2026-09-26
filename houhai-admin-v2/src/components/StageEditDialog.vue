<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { ImagePlus, RefreshCw, Sparkles, Trash2, X } from 'lucide-vue-next'
import { useDemoAdmin } from '../composables/useDemoAdmin'
import { createStageImage } from '../data/mock'
import { localeLabelOf } from '../domain/content'
import type { ArtifactStage, StagePronunciation } from '../types'
import { DEMO_AUDIO_PREFIX, cloneValue, estimateAudioSeconds, formatClock, formatDurationText, resolveAudioUrl } from '../utils'

/** 站点内容语言跟随所属路线：中文路线产出 TTS 音频，其它语言由 C 端系统语音朗读。 */
const props = defineProps<{ stage: ArtifactStage }>()
const emit = defineEmits<{ close: []; save: [value: ArtifactStage] }>()
const { database, notify } = useDemoAdmin()

const draft = ref<ArtifactStage>(cloneValue(props.stage))
const imageMode = ref<'upload' | 'ai'>('upload')
const imagePrompt = ref('')
const guidePickerOpen = ref(false)
const pronunciationDraft = ref<StagePronunciation | null>(null)
const error = ref('')

const isSourceLocale = computed(() => draft.value.locale === 'zh')
const targetLocale = computed(() => localeLabelOf(draft.value.locale))
const guideLabel = computed(() => draft.value.guideName || '未选择导游')
const scriptSeconds = computed(() => draft.value.segments.reduce((total, segment) => total + (segment.durationSeconds || estimateAudioSeconds(segment.text)), 0))
const canGenerateAudio = computed(() => isSourceLocale.value && draft.value.segments.some(segment => segment.text.trim().length > 0))
const audioStateLabel = computed(() => {
  if (draft.value.audioStatus === 'queued') return '已提交生成，完成后请点击刷新查看。'
  if (draft.value.audioStatus === 'ready') return `已生成 · 共 ${formatDurationText(draft.value.audioDurationSeconds)}`
  return '尚未生成 · 生成后可试听'
})
const dirty = computed(() => JSON.stringify(draft.value) !== JSON.stringify(props.stage))

onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))
function onKey(event: KeyboardEvent) { if (event.key === 'Escape') requestClose() }

/** 导游候选来自演示数据中已有的讲解版本，保持与“导游管理”一致的名单。 */
const guideOptions = computed(() => {
  const map = new Map<string, { id: string; name: string; style: string }>()
  for (const place of database.places) for (const narration of place.narrations) map.set(narration.guideId, { id: narration.guideId, name: narration.guideName, style: narration.guideStyle })
  return [...map.values()]
})

function pickGuide(guide: { id: string; name: string; style: string }) {
  draft.value.guideId = guide.id
  draft.value.guideName = guide.name
  draft.value.guideStyle = guide.style
  guidePickerOpen.value = false
}
function addSegment() {
  const index = draft.value.segments.length + 1
  draft.value.segments.push({ id: `${draft.value.id}-seg-${Date.now()}`, title: `第 ${index} 段`, text: '', audioUrl: null, durationSeconds: 0 })
}
function removeSegment(index: number) {
  if (draft.value.segments.length <= 1) return
  draft.value.segments.splice(index, 1)
}
function startPronunciation() {
  pronunciationDraft.value = { id: '', phrase: '', pronunciation: '', note: '' }
}
function editPronunciation(item: StagePronunciation) {
  pronunciationDraft.value = cloneValue(item)
}
function applyPronunciation() {
  const editor = pronunciationDraft.value
  if (!editor) return
  const phrase = editor.phrase.trim()
  const pronunciation = editor.pronunciation.trim()
  if (!phrase || !pronunciation) { error.value = '请填写多音字词语与标准拼音'; return }
  error.value = ''
  const next = { ...editor, phrase, pronunciation, note: editor.note.trim() }
  const index = draft.value.pronunciations.findIndex(item => item.id === next.id)
  if (index >= 0) draft.value.pronunciations[index] = next
  else draft.value.pronunciations.push({ ...next, id: `${draft.value.id}-pro-${Date.now()}` })
  pronunciationDraft.value = null
}
function removePronunciation(id: string) {
  draft.value.pronunciations = draft.value.pronunciations.filter(item => item.id !== id)
}
function refreshImages() { notify('配图列表已刷新') }
function uploadImage() {
  const index = draft.value.images.length + 1
  draft.value.images.push(createStageImage(`${draft.value.id}-img-${Date.now()}`, `本地图片 ${index} · 站点实拍`, '实拍', 34))
  notify('图片已加入配图列表，保存后同步到 C 端')
}
function generateImage() {
  const prompt = imagePrompt.value.trim()
  if (!prompt) { error.value = '请先填写画面描述，再开始生成'; return }
  error.value = ''
  const index = draft.value.images.length + 1
  draft.value.images.push(createStageImage(`${draft.value.id}-img-${Date.now()}`, `AI 生成 ${index} · ${prompt.slice(0, 12)}`, 'AI', 224, 'ai'))
  imagePrompt.value = ''
  notify('已提交 AI 配图生成，完成后请点击刷新查看')
}
function removeImage(index: number) {
  draft.value.images.splice(index, 1)
}
function generateAudio() {
  if (!canGenerateAudio.value) return
  error.value = ''
  draft.value.audioStatus = 'queued'
  notify('已提交生成，完成后请点击刷新查看')
}
function refreshAudio() {
  if (draft.value.audioStatus === 'none') { notify('还没有生成任务，请先点击生成'); return }
  for (const segment of draft.value.segments) {
    if (!segment.durationSeconds) segment.durationSeconds = estimateAudioSeconds(segment.text)
    if (!segment.audioUrl) segment.audioUrl = DEMO_AUDIO_PREFIX
  }
  draft.value.audioDurationSeconds = draft.value.segments.reduce((total, segment) => total + segment.durationSeconds, 0)
  draft.value.audioStatus = 'ready'
  notify('音频状态已刷新，可试听')
}
function requestClose() {
  if (dirty.value && !window.confirm('放弃未保存的修改？')) return
  emit('close')
}
function save() {
  const name = draft.value.name.trim()
  if (!name) { error.value = `请填写${targetLocale.value}站点名称`; return }
  if (!draft.value.segments.some(segment => segment.text.trim())) { error.value = `请至少填写一段${targetLocale.value}解说词`; return }
  error.value = ''
  draft.value.name = name
  emit('save', cloneValue(draft.value))
  emit('close')
}
</script>

<template>
  <div class="stage-modal" @click.self="requestClose">
    <section class="stage-dialog" role="dialog" aria-label="编辑这一站">
      <header class="stage-dialog-head">
        <div><span class="eyebrow">编辑这一站</span><h3>{{ draft.name || '未命名站点' }} - 解说导览<em class="stage-locale-tag">{{ targetLocale }}版本</em></h3></div>
        <button class="icon-button" aria-label="关闭" @click="requestClose"><X :size="18" /></button>
      </header>

      <div class="stage-dialog-body">
        <div class="stage-dialog-main">
          <p class="stage-hint">站点语言跟随路线（{{ targetLocale }}）；切换语言版本请在工作台头部切换同线路的其它语言路线。</p>

          <div class="stage-fields-row">
            <label class="stage-field">站点名称<input v-model="draft.name" :placeholder="isSourceLocale ? '例如：银锭桥' : 'Station name'" /></label>
            <label class="stage-field">类别<input v-model="draft.category" :placeholder="isSourceLocale ? '例如：历史桥梁' : 'Category'" /></label>
          </div>
          <label class="stage-field">一句话摘要<input v-model="draft.summary" :placeholder="isSourceLocale ? '用于 C 端列表与站点卡片' : 'One-line summary'" /></label>

          <section class="stage-section">
            <div class="stage-section-head">
              <strong>解说词<em>{{ draft.segments.length }} 段 · 约 {{ formatDurationText(scriptSeconds) }}</em></strong>
              <div><button class="mini-button" @click="addSegment">新增段落</button></div>
            </div>
            <article v-for="(segment, index) in draft.segments" :key="segment.id" class="segment-card">
              <header>
                <b>第 {{ index + 1 }} 段</b>
                <input v-model="segment.title" placeholder="段落标题" />
                <small v-if="isSourceLocale">{{ segment.audioUrl ? `音频 ${formatClock(segment.durationSeconds)}` : '音频待生成' }}</small>
                <small v-else>系统语音</small>
                <button v-if="draft.segments.length > 1" aria-label="删除段落" @click="removeSegment(index)"><Trash2 :size="13" /></button>
              </header>
              <textarea v-model="segment.text" rows="4" :placeholder="isSourceLocale ? '填写这一段的解说词…' : 'Write this section of the narration…'" />
            </article>
          </section>

          <section class="stage-section">
            <div class="stage-section-head">
              <strong>关联多音字<em>{{ draft.pronunciations.length }} 条 · 仅中文讲解使用</em></strong>
              <div>
                <button class="mini-button" @click="notify('多音字列表已刷新')"><RefreshCw :size="12" />刷新</button>
                <button class="mini-button gold" @click="startPronunciation">新增多音字</button>
              </div>
            </div>
            <div v-if="pronunciationDraft" class="pronunciation-editor">
              <input v-model="pronunciationDraft.phrase" placeholder="词语，例如 宴飨" />
              <input v-model="pronunciationDraft.pronunciation" placeholder="拼音，例如 yan4 xiang3" />
              <input v-model="pronunciationDraft.note" placeholder="说明（选填）" />
              <button class="button primary small" @click="applyPronunciation">保存</button>
              <button class="button ghost small" @click="pronunciationDraft = null">取消</button>
            </div>
            <div v-if="draft.pronunciations.length" class="pronunciation-grid">
              <article v-for="item in draft.pronunciations" :key="item.id">
                <div><strong>{{ item.phrase }}</strong><small>{{ item.note }}</small></div>
                <code>{{ item.pronunciation }}</code>
                <button @click="editPronunciation(item)">编辑</button>
                <button @click="removePronunciation(item.id)">删除</button>
              </article>
            </div>
            <p v-else class="stage-hint">当前站点暂无多音字词条，可新增人名、地名与专业词汇的标准读音。</p>
          </section>

          <section class="stage-section">
            <div class="stage-section-head">
              <strong>配图<em>{{ draft.images.length }} 张</em></strong>
              <div>
                <button class="mini-button" @click="refreshImages"><RefreshCw :size="12" />刷新</button>
                <div class="source-switch" role="tablist" aria-label="配图来源">
                  <button role="tab" :aria-selected="imageMode === 'upload'" :class="{ active: imageMode === 'upload' }" @click="imageMode = 'upload'">上传</button>
                  <button role="tab" :aria-selected="imageMode === 'ai'" :class="{ active: imageMode === 'ai' }" @click="imageMode = 'ai'">AI 生成</button>
                </div>
                <button v-if="imageMode === 'upload'" class="mini-button gold" @click="uploadImage"><ImagePlus :size="12" />选择图片</button>
                <button v-else class="mini-button gold" :disabled="!imagePrompt.trim()" @click="generateImage"><Sparkles :size="12" />开始生成</button>
              </div>
            </div>
            <textarea v-if="imageMode === 'ai'" v-model="imagePrompt" class="image-prompt" rows="2" placeholder="描述希望生成的画面，例如：桥面与水面局部特写，黄昏光线…" />
            <div v-if="draft.images.length" class="image-grid">
              <figure v-for="(image, index) in draft.images" :key="image.id">
                <img :src="image.url" :alt="image.caption" />
                <figcaption><span>{{ index === 0 ? '封面' : `配图 ${index + 1}` }}</span><small>{{ image.source === 'ai' ? 'AI 生成' : '上传' }}</small></figcaption>
                <button aria-label="删除配图" @click="removeImage(index)"><Trash2 :size="12" /></button>
              </figure>
            </div>
            <p v-else class="stage-hint">暂无配图，可上传本地图片，或由 AI 按画面描述生成。</p>
          </section>
        </div>

        <aside class="stage-dialog-side">
          <div class="stage-field">
            <div class="stage-section-head"><strong>导游</strong><button class="mini-button gold" @click="guidePickerOpen = !guidePickerOpen">{{ guidePickerOpen ? '收起' : '选择' }}</button></div>
            <p class="guide-value"><b>{{ guideLabel }}</b><small>{{ draft.guideStyle || '选择后将使用该导游的讲解风格' }}</small></p>
            <div v-if="guidePickerOpen" class="guide-options">
              <button v-for="guide in guideOptions" :key="guide.id" :class="{ active: guide.id === draft.guideId }" @click="pickGuide(guide)"><strong>{{ guide.name }}</strong><small>{{ guide.style }}</small></button>
            </div>
          </div>

          <div class="stage-section">
            <div class="stage-section-head">
              <strong>音频<em>仅中文生成</em></strong>
              <div>
                <button class="mini-button" :disabled="!isSourceLocale" @click="refreshAudio"><RefreshCw :size="12" />刷新</button>
                <button class="mini-button gold" :disabled="!canGenerateAudio || draft.audioStatus === 'queued'" @click="generateAudio">生成</button>
              </div>
            </div>
            <p v-if="isSourceLocale" class="audio-state" :class="{ pending: draft.audioStatus === 'queued' }">{{ audioStateLabel }}</p>
            <p v-else class="audio-state">{{ targetLocale }}讲解由 C 端使用系统语音朗读，无需生成音频。</p>
            <template v-if="isSourceLocale">
              <template v-for="(segment, index) in draft.segments" :key="`audio-${segment.id}`">
                <div v-if="segment.audioUrl" class="segment-audio">
                  <small>第 {{ index + 1 }} 段 · {{ formatClock(segment.durationSeconds) }}</small>
                  <audio controls preload="none" :src="resolveAudioUrl(segment.audioUrl, segment.durationSeconds) ?? undefined" />
                </div>
              </template>
            </template>
          </div>

          <div class="stage-section">
            <div class="stage-section-head"><strong>视频</strong><em>选填</em></div>
            <label class="stage-field"><input v-model="draft.videoUrl" placeholder="到达后可观看的短片地址" /></label>
          </div>
        </aside>
      </div>

      <footer class="stage-dialog-foot">
        <p v-if="error" class="stage-error" role="alert">{{ error }}</p>
        <button class="button ghost" @click="requestClose">取消</button>
        <button class="button primary" @click="save">保存</button>
      </footer>
    </section>
  </div>
</template>
