<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { Landmark, Lock, Pause, Pencil, Play, RotateCcw, RotateCw, Send, Trash2, Video, ZoomIn, ZoomOut } from 'lucide-vue-next'
import { useDemoAdmin } from '../composables/useDemoAdmin'
import type { ArtifactStage, TourRoute } from '../types'
import { formatClock, formatDurationText } from '../utils'
import StageEditDialog from './StageEditDialog.vue'

const props = defineProps<{ route: TourRoute; stages: ArtifactStage[] }>()
const emit = defineEmits<{ close: []; publish: []; saveStage: [value: ArtifactStage]; removeStage: [id: string] }>()
const { notify } = useDemoAdmin()

const activeStageId = ref(props.stages[0]?.id ?? '')
const editingStageId = ref('')
const prompt = ref('')
const sentMessage = ref('')
const chapterIndex = ref(0)
const elapsed = ref(0)
const playing = ref(false)
let timer: ReturnType<typeof setInterval> | undefined

const activeStage = computed(() => props.stages.find(item => item.id === activeStageId.value) ?? props.stages[0] ?? null)
const editingStage = computed(() => props.stages.find(item => item.id === editingStageId.value) ?? null)
const segments = computed(() => activeStage.value?.segments ?? [])
const activeSegment = computed(() => segments.value[chapterIndex.value] ?? null)
const segmentSeconds = computed(() => activeSegment.value?.durationSeconds ?? 0)
const coverImage = computed(() => activeStage.value?.images[0] ?? null)
const audioReady = computed(() => activeStage.value?.audioStatus === 'ready')

watch(() => activeStage.value?.id, () => { chapterIndex.value = 0; elapsed.value = 0; playing.value = false; syncTimer() })
onUnmounted(() => clearInterval(timer))

function audioLabel(stage: ArtifactStage) {
  return stage.audioStatus === 'ready' ? '音频已生成' : stage.audioStatus === 'queued' ? '音频生成中' : '音频待生成'
}
function selectStage(id: string) { activeStageId.value = id }
function openStageEditor(id: string) { activeStageId.value = id; editingStageId.value = id }
function removeActiveStage() {
  const stage = activeStage.value
  if (!stage) return
  if (!window.confirm(`确定从当前路线移除站点“${stage.name}”？`)) return
  activeStageId.value = props.stages.find(item => item.id !== stage.id)?.id ?? ''
  emit('removeStage', stage.id)
}
function syncTimer() {
  clearInterval(timer)
  if (!playing.value) return
  timer = setInterval(() => {
    elapsed.value += 1
    if (elapsed.value < segmentSeconds.value) return
    elapsed.value = 0
    if (chapterIndex.value < (activeStage.value?.segments.length ?? 1) - 1) chapterIndex.value += 1
    else { playing.value = false; syncTimer() }
  }, 1000)
}
function togglePlay() {
  const stage = activeStage.value
  if (!stage) return
  if (!audioReady.value) { notify(stage.audioStatus === 'queued' ? '音频生成中，完成后可试听' : '该站点音频尚未生成'); return }
  if (!segmentSeconds.value) { notify('当前段落还没有音频时长，可先在编辑窗口刷新音频'); return }
  playing.value = !playing.value
  syncTimer()
}
function pickChapter(index: number) { chapterIndex.value = index; elapsed.value = 0; syncTimer() }
function sendPrompt() { if (!prompt.value.trim()) return; sentMessage.value = prompt.value.trim(); prompt.value = '' }
</script>

<template>
  <div class="artifact-editor">
    <div class="artifact-main">
      <section class="node-canvas">
        <div class="node-canvas-hint">共 {{ stages.length }} 个站点 · 单击预览，双击编辑内容<em class="fallback-note">语言：{{ props.route.locale === 'zh' ? '中文' : props.route.locale.toUpperCase() }}</em></div>
        <div class="node-actions"><button @click="removeActiveStage"><Trash2 :size="14"/>删除</button><button class="gold" @click="activeStage && openStageEditor(activeStage.id)"><Pencil :size="14"/>编辑</button></div>
        <div class="node-flow">
          <template v-for="(stage, index) in stages" :key="stage.id">
            <button :class="['artifact-node', { active: stage.id === activeStage?.id }]" @click="selectStage(stage.id)" @dblclick="openStageEditor(stage.id)">
              <span class="artifact-node-title"><i>{{ index + 1 }}.</i>{{ stage.name }}<small>{{ stage.category }} · 解说导览</small></span>
              <span class="artifact-node-badges"><em :class="{ ready: stage.audioStatus === 'ready', queued: stage.audioStatus === 'queued' }">{{ audioLabel(stage) }}</em><em>{{ stage.segments.length }} 段</em><em>配图 {{ stage.images.length }}</em><em>多音字 {{ stage.pronunciations.length }}</em></span>
            </button>
            <i v-if="index < stages.length - 1" class="node-link" aria-hidden="true" />
          </template>
          <p v-if="!stages.length" class="node-empty">当前路线还没有讲解站点。</p>
        </div>
        <div class="canvas-tools"><button><ZoomIn :size="15"/></button><button><ZoomOut :size="15"/></button><button><span>⌗</span></button><button><Lock :size="14"/></button></div>
      </section>

      <section class="phone-preview">
        <div class="phone-screen">
          <div class="phone-status"><b>9:41</b><span>▮▮▮</span></div>
          <span class="audio-label">AUDIO GUIDE · {{ activeStage?.category ?? '讲解站点' }}</span>
          <h2>{{ activeStage?.name ?? '未选择站点' }}</h2>
          <p>{{ activeStage?.guideName ?? '未选择导游' }} · {{ activeStage?.guideStyle ?? '—' }}</p>
          <div class="artifact-visual"><img v-if="coverImage" :src="coverImage.url" :alt="coverImage.caption"/><template v-else><Landmark :size="116" :stroke-width="1"/><span>{{ activeStage?.name }}</span></template></div>
          <small>{{ coverImage ? `${activeStage?.images.length} 张配图 · 点按放大` : '暂无配图 · 可在编辑窗口上传' }}</small>
          <div v-if="segments.length > 1" class="stage-chapters"><button v-for="(segment, index) in segments" :key="segment.id" :class="{ active: index === chapterIndex }" @click="pickChapter(index)"><b>{{ index + 1 }}</b>{{ segment.title }}<em>{{ segment.durationSeconds ? formatClock(segment.durationSeconds) : '待生成' }}</em></button></div>
          <p v-if="activeSegment" class="stage-script">{{ activeSegment.text }}</p>
          <div class="audio-progress"><i :style="{ width: `${segmentSeconds ? Math.min(100, (elapsed / segmentSeconds) * 100) : 0}%` }"/></div>
          <div class="audio-time"><span>{{ formatClock(elapsed) }}</span><span>-{{ formatClock(Math.max(0, segmentSeconds - elapsed)) }}</span></div>
          <div class="audio-controls"><RotateCcw :size="27"/><button :aria-label="playing ? '暂停讲解' : '播放讲解'" @click="togglePlay"><Pause v-if="playing" :size="24" fill="currentColor"/><Play v-else :size="24" fill="currentColor"/></button><RotateCw :size="27"/><b>文</b></div>
          <em>{{ playing ? '播放中' : audioReady ? `已生成 · 共 ${formatDurationText(activeStage?.audioDurationSeconds ?? 0)}` : '音频待生成' }}</em>
          <button v-if="activeStage?.videoUrl" class="stage-video"><Video :size="13"/>观看视频</button>
        </div>
      </section>

      <section class="route-chat"><div class="chat-empty" v-if="!sentMessage"><strong>用对话编辑当前路线</strong><p>例如：给当前站点增加提示，或按主题补几个站点。</p></div><div v-else class="chat-result"><span>你的修改要求</span><p>{{ sentMessage }}</p><strong>已记录到当前讲解站点，等待确认应用。</strong></div><div class="chat-composer"><span>路线　{{ props.route.name }}<i v-if="activeStage"> ｜ 站点　{{ activeStage.name }}</i></span><textarea v-model="prompt" rows="3" placeholder="描述你想对当前路线或站点做的修改…" @keydown.enter.exact.prevent="sendPrompt"/><div><small>可粘贴图片 · Enter 发送 · Shift+Enter 换行</small><button @click="sendPrompt"><Send :size="16"/></button></div></div></section>
    </div>
    <footer class="artifact-footer"><button class="button ghost" @click="emit('close')">关闭</button><button class="button primary" @click="emit('publish')">{{ props.route.status==='published'?'保存':'上架' }}</button></footer>

    <StageEditDialog v-if="editingStage" :key="editingStage.id" :stage="editingStage" @close="editingStageId=''" @save="emit('saveStage',$event)"/>
  </div>
</template>
