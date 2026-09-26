<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, useTemplateRef } from 'vue'
import { Bot, Library, Route, Send, Sparkles, UserRound, X } from 'lucide-vue-next'
import { contentLocales } from '../config/locales'
import { localeLabelOf } from '../domain/content'
import { buildLanguageVersion, buildRouteFromPlan, planRouteFromPrompt, type RouteChatPlan, type RouteChatResult } from '../domain/routeChat'
import type { ArtifactStage, CollectionItem, CulturalPlace, Destination, IndoorSpace, Locale, TourRoute } from '../types'

interface ChatMessage { id: string; role: 'user' | 'assistant'; content: string }
interface PastedImage { id: string; url: string; name: string }
interface BuildProgress { message: string; created: number; total: number; status: 'running' | 'completed' }

const props = withDefaults(defineProps<{
  destinations: Destination[]
  places: CulturalPlace[]
  collections: CollectionItem[]
  indoorSpaces: IndoorSpace[]
  routes: TourRoute[]
  /** 既有站点内容：非中文路线按 `placeId + locale` 复用已经维护好的译文。 */
  stages: ArtifactStage[]
  ownerName?: string
}>(), { ownerName: '内容运营' })

const emit = defineEmits<{ close: []; create: [value: RouteChatResult[]] }>()

const prompt = ref('')
const locale = ref<Locale>('zh')
const messages = ref<ChatMessage[]>([])
const plan = ref<RouteChatPlan | null>(null)
const progress = ref<BuildProgress | null>(null)
const createdHint = ref('')
const running = ref(false)
const pastedImages = ref<PastedImage[]>([])
const messageList = useTemplateRef<HTMLElement>('messageList')
let timers: number[] = []

const related = computed(() => plan.value?.related ?? [])
const routeTitle = computed(() => plan.value?.name ?? '尚未生成路线')
const routeTheme = computed(() => plan.value?.theme ?? '—')
const routeCode = computed(() => plan.value?.code ?? '')
const progressPercent = computed(() => progress.value && progress.value.total > 0
  ? Math.round(progress.value.created / progress.value.total * 100)
  : 0)

function schedule(delay: number, callback: () => void) {
  timers.push(window.setTimeout(callback, delay))
}
function clearTimers() {
  timers.forEach(id => window.clearTimeout(id))
  timers = []
}
function releaseImages() {
  pastedImages.value.forEach(image => URL.revokeObjectURL(image.url))
  pastedImages.value = []
}
async function scrollToBottom() {
  await nextTick()
  messageList.value?.scrollTo({ top: messageList.value.scrollHeight, behavior: 'smooth' })
}

/** 演示版按提示词在现有数据里挑选目的地、关联文物与站点，替代正式版的后端生成。 */
function send() {
  const content = prompt.value.trim()
  if (!content || running.value) return
  const attached = pastedImages.value.length
  messages.value = [...messages.value, { id: `user-${Date.now()}`, role: 'user', content: attached ? `${content}（附 ${attached} 张参考图）` : content }]
  prompt.value = ''
  releaseImages()
  running.value = true
  createdHint.value = ''
  progress.value = null
  plan.value = null
  void scrollToBottom()

  const next = planRouteFromPrompt(content, {
    destinations: props.destinations,
    places: props.places,
    collections: props.collections,
    indoorSpaces: props.indoorSpaces,
    routes: props.routes,
  })

  schedule(600, () => {
    plan.value = next
    messages.value = [...messages.value, { id: `assistant-${Date.now()}`, role: 'assistant', content: planSummary(next) }]
    void scrollToBottom()
    startBuild(next)
  })
}

function planSummary(next: RouteChatPlan): string {
  const head = `已按提示词规划路线《${next.name}》：${next.theme}。目的地 ${next.destinationName}，共 ${next.stops.length} 个站点。`
  return next.fallback
    ? `${head}演示数据里暂时没有直接匹配的内容，先沿用该目的地现有文化点搭好骨架，可在工作台里替换站点。`
    : `${head}命中的内容已归入右侧「关联文物」，站点生成后可在列表里继续编辑。`
}

function startBuild(next: RouteChatPlan) {
  if (!next.stops.length) { finish(next); return }
  progress.value = { message: `正在创建第 1 个站点，累计 0/${next.stops.length}`, created: 0, total: next.stops.length, status: 'running' }
  const step = () => {
    const current = progress.value
    if (!current) return
    const created = current.created + 1
    progress.value = created < current.total
      ? { message: `正在创建第 ${created + 1} 个站点，累计 ${created}/${current.total}`, created, total: current.total, status: 'running' }
      : { message: `站点创建完成，正在整理讲解内容`, created, total: current.total, status: 'running' }
    if (created < current.total) { schedule(360, step); return }
    finish(next)
  }
  schedule(360, step)
}

function finish(next: RouteChatPlan) {
  const source = buildRouteFromPlan(next, props.ownerName)
  const entries: RouteChatResult[] = [source]
  if (locale.value !== 'zh') {
    const destination = props.destinations.find(item => item.id === next.destinationId) ?? null
    entries.push(buildLanguageVersion(source, locale.value, props.ownerName, { destination, library: props.stages }))
  }
  const target = entries[entries.length - 1]
  emit('create', entries)
  progress.value = { message: `已创建 ${source.stages.length} 个站点，共 ${next.stops.length} 个`, created: source.stages.length, total: Math.max(next.stops.length, 1), status: 'completed' }
  createdHint.value = entries.length > 1
    ? `已创建中文源路线 ${source.route.code} 与 ${localeLabelOf(locale.value)} 版本 ${target.route.code}。`
    : `已创建草稿路线 ${source.route.code}，可在列表中继续编辑或提交审核。`
  messages.value = [...messages.value, { id: `assistant-${Date.now()}`, role: 'assistant', content: `路线《${source.route.name}》（${source.route.code}）已保存为草稿：${source.stages.length} 个站点内容一并生成，音频为演示素材，可逐站替换后提交审核。${entries.length > 1 ? `同时创建了 ${localeLabelOf(locale.value)} 版本《${target.route.name}》（${target.route.code}），站点译文按现有数据复用或标记待补。` : ''}` }]
  running.value = false
  void scrollToBottom()
}

function onPaste(event: ClipboardEvent) {
  const files = Array.from(event.clipboardData?.items ?? [])
    .filter(item => item.kind === 'file' && item.type.startsWith('image/'))
    .map(item => item.getAsFile())
    .filter((file): file is File => Boolean(file))
    .slice(0, Math.max(4 - pastedImages.value.length, 0))
  if (!files.length) return
  event.preventDefault()
  pastedImages.value = [...pastedImages.value, ...files.map(file => ({
    id: `${file.name}-${file.size}-${pastedImages.value.length}-${Date.now()}`,
    url: URL.createObjectURL(file),
    name: file.name,
  }))]
}

function removeImage(id: string) {
  const target = pastedImages.value.find(image => image.id === id)
  if (target) URL.revokeObjectURL(target.url)
  pastedImages.value = pastedImages.value.filter(image => image.id !== id)
}

function requestClose() {
  clearTimers()
  releaseImages()
  emit('close')
}

function onKey(event: KeyboardEvent) { if (event.key === 'Escape') requestClose() }
onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => {
  window.removeEventListener('keydown', onKey)
  clearTimers()
  releaseImages()
})
</script>

<template>
  <div class="form-modal" @click.self="requestClose">
    <section class="route-chat-dialog" role="dialog" aria-label="新增主题路线">
      <header class="form-dialog-head">
        <div><span class="eyebrow">主题路线</span><h3>新增主题路线</h3><p>输入一句话主题，通过对话创建路线。</p></div>
        <button class="icon-button" aria-label="关闭" @click="requestClose"><X :size="18" /></button>
      </header>

      <div class="route-chat-body">
        <div class="route-chat-main">
          <div ref="messageList" class="route-chat-messages">
            <div v-if="!messages.length" class="route-chat-empty">
              <span><Sparkles :size="19" /></span>
              <strong>用对话创建主题路线</strong>
              <p>例如：帮我创建一条关于宋代瓷器的讲解路线，覆盖 6 到 8 个站点。</p>
            </div>
            <article v-for="message in messages" :key="message.id" :class="['route-chat-message', message.role]">
              <span><UserRound v-if="message.role === 'user'" :size="13" /><Bot v-else :size="13" /></span>
              <p>{{ message.content }}</p>
            </article>
          </div>

          <div class="route-chat-composer">
            <div class="route-chat-locale">
              <span>路线语言</span>
              <span class="content-locales"><button v-for="item in contentLocales" :key="item.id" type="button" :disabled="running" :class="{ active: locale === item.id }" @click="locale = item.id">{{ item.label }}</button></span>
              <small>{{ locale === 'zh' ? '默认创建中文源版本' : `中文源 + ${localeLabelOf(locale)} 版本一起创建` }}</small>
            </div>
            <div v-if="pastedImages.length" class="route-chat-images">
              <figure v-for="image in pastedImages" :key="image.id">
                <img :src="image.url" :alt="image.name" />
                <button type="button" aria-label="移除参考图" @click="removeImage(image.id)"><X :size="11" /></button>
              </figure>
            </div>
            <div class="composer-box">
              <textarea v-model="prompt" rows="3" :disabled="running" placeholder="描述主题、受众、站点数量或讲解风格…" @keydown.enter.exact.prevent="send" @paste="onPaste" />
              <div><small>{{ running ? '正在按提示词生成路线与站点…' : '可粘贴图片 · Enter 发送 · Shift+Enter 换行' }}</small><button aria-label="发送" :disabled="running || !prompt.trim()" @click="send"><Send :size="15" /></button></div>
            </div>
          </div>
        </div>

        <aside class="route-chat-aside">
          <div class="aside-head"><strong>生成结果</strong><span>对话过程中的路线与文物摘要</span></div>
          <div class="aside-scroll">
            <section>
              <div class="aside-label"><Route :size="13" />当前路线</div>
              <div class="aside-card">
                <p>{{ routeTitle }}</p>
                <dl>
                  <div><dt>主题</dt><dd>{{ routeTheme }}</dd></div>
                  <div><dt>语言</dt><dd>{{ localeLabelOf(locale) }}</dd></div>
                  <div v-if="routeCode"><dt>编号</dt><dd>{{ routeCode }}</dd></div>
                  <div v-if="plan"><dt>景点</dt><dd>{{ plan.destinationName }}</dd></div>
                </dl>
                <p v-if="createdHint" class="aside-hint">{{ createdHint }}</p>
              </div>
            </section>

            <section v-if="progress">
              <div class="aside-label"><Sparkles :size="13" />站点生成</div>
              <div :class="['aside-card', progress.status]">
                <p>{{ progress.message }}</p>
                <dl><div><dt>进度</dt><dd>已创建 {{ progress.created }}/{{ progress.total }}</dd></div></dl>
                <div class="aside-progress"><i :style="{ width: `${progressPercent}%` }" /></div>
              </div>
            </section>

            <section>
              <div class="aside-label"><Library :size="13" />关联文物</div>
              <div v-if="!related.length" class="aside-empty">对话中选中的文物会显示在这里。</div>
              <ul v-else class="aside-list">
                <li v-for="item in related" :key="item.id"><strong>{{ item.name }}</strong><span>{{ item.meta }}</span></li>
              </ul>
            </section>
          </div>
        </aside>
      </div>

      <footer class="form-dialog-foot">
        <button class="button ghost" @click="requestClose">关闭</button>
      </footer>
    </section>
  </div>
</template>

<style scoped>
.route-chat-dialog{display:flex;flex-direction:column;width:min(1280px,96vw);height:min(880px,92vh);overflow:hidden;border:1px solid #30343a;border-radius:12px;background:#16191d;color:#ecedef;box-shadow:0 25px 70px #000000b3}
.route-chat-body{flex:1;min-height:0;display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:14px;padding:14px 18px}
.route-chat-main{display:flex;min-height:0;flex-direction:column;border:1px solid #2b2f34;border-radius:10px;background:#101317;overflow:hidden}
.route-chat-messages{flex:1;min-height:0;overflow:auto;padding:16px}
.route-chat-empty{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px;text-align:center;color:#9ca3aa}
.route-chat-empty>span{width:42px;height:42px;border:1px solid #4c432d;border-radius:50%;display:grid;place-items:center;color:#d5b15b;background:#211e17}
.route-chat-empty strong{margin-top:14px;font-size:13px;color:#dfe2e4}
.route-chat-empty p{max-width:330px;margin:9px 0 0;font-size:11px;line-height:1.8;color:#7f878e}
.route-chat-message{display:grid;grid-template-columns:26px 1fr;gap:8px;margin-bottom:12px}
.route-chat-message>span{width:26px;height:26px;border-radius:50%;display:grid;place-items:center;background:#25292e;color:#b9c0c5}
.route-chat-message p{margin:0;padding:9px 11px;border-radius:8px;background:#1b1f24;color:#d8dcdf;font-size:11px;line-height:1.75}
.route-chat-message.user>span{background:#453a24;color:#e1bd65}
.route-chat-message.user p{background:#242016;color:#ead7a7}
.route-chat-composer{border-top:1px solid #2d3136;padding:12px}
.route-chat-locale{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-bottom:9px}
.route-chat-locale>span{font-size:10px;color:#8e969f}
.route-chat-locale small{font-size:9px;color:#717980}
.route-chat-images{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:9px}
.route-chat-images figure{position:relative;margin:0}
.route-chat-images img{display:block;width:58px;height:44px;object-fit:cover;border:1px solid #30343a;border-radius:6px}
.route-chat-images button{position:absolute;right:-6px;top:-6px;width:18px;height:18px;display:grid;place-items:center;border:0;border-radius:50%;background:#0d0f12d9;color:#e6e9eb}
.composer-box{border:1px solid #34383e;border-radius:8px;background:#16191e;padding:9px}
.composer-box textarea{width:100%;resize:none;border:0;outline:0;background:transparent;color:#edf0f2;font-size:11px;line-height:1.6;font-family:inherit}
.composer-box textarea::placeholder{color:#6c757c}
.composer-box>div{display:flex;align-items:center;justify-content:space-between;gap:8px}
.composer-box small{color:#717980;font-size:9px}
.composer-box button{width:30px;height:30px;border:0;border-radius:50%;display:grid;place-items:center;background:#806b39;color:#fff}
.composer-box button:disabled{opacity:.45;cursor:not-allowed}
.route-chat-aside{display:flex;min-height:0;flex-direction:column;border:1px solid #2b2f34;border-radius:10px;background:#101317;overflow:hidden}
.aside-head{padding:12px 14px;border-bottom:1px solid #2d3136}
.aside-head strong{font-size:13px}
.aside-head span{display:block;margin-top:4px;font-size:10px;color:#8e969f}
.aside-scroll{flex:1;min-height:0;overflow:auto;padding:14px;display:grid;gap:16px;align-content:start}
.aside-label{display:flex;align-items:center;gap:6px;font-size:11px;color:#8e969f}
.aside-card{margin-top:8px;padding:11px;border:1px solid #30343a;border-radius:8px;background:#13161a}
.aside-card>p{margin:0;font-size:12px;color:#ecedef}
.aside-card dl{margin:9px 0 0;display:grid;gap:6px}
.aside-card dl>div{display:flex;gap:8px;font-size:10px}
.aside-card dt{flex:none;color:#8e969f}
.aside-card dd{margin:0;min-width:0;color:#c8ced4;word-break:break-all}
.aside-card.completed{border-color:#2f5a45;background:#12241c}
.aside-card.completed>p{color:#66d3a1}
.aside-progress{margin-top:9px;height:5px;border-radius:999px;background:#22262b;overflow:hidden}
.aside-progress i{display:block;height:100%;border-radius:999px;background:#d8b65e;transition:width .3s}
.aside-card.completed .aside-progress i{background:#66d3a1}
.aside-hint{margin:9px 0 0 !important;font-size:10px;color:#66d3a1}
.aside-empty{padding:14px;border:1px dashed #2d3136;border-radius:8px;font-size:10px;line-height:1.7;color:#8e969f}
.aside-list{list-style:none;margin:8px 0 0;padding:0;display:grid;gap:7px}
.aside-list li{display:grid;gap:3px;padding:8px 10px;border:1px solid #30343a;border-radius:8px;background:#13161a}
.aside-list strong{font-size:11px;color:#ecedef}
.aside-list span{font-size:9px;color:#8e969f}
</style>
