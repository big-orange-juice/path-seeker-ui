<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { Check, Languages, X } from 'lucide-vue-next'
import { contentLocales } from '../config/locales'
import { localeLabelOf, siblingRoutes } from '../domain/content'
import { buildLanguageVersion, reusableStageCount, type RouteChatResult } from '../domain/routeChat'
import type { ArtifactStage, Destination, Locale, TourRoute } from '../types'

const props = withDefaults(defineProps<{
  route: TourRoute
  routes: TourRoute[]
  stages: ArtifactStage[]
  destinations: Destination[]
  ownerName?: string
}>(), { ownerName: '内容运营' })

const emit = defineEmits<{ close: []; created: [value: RouteChatResult[]] }>()

const versions = computed(() => siblingRoutes(props.route, props.routes))
/** 转换方向固定：源版本始终取同线路的中文记录。 */
const source = computed(() => versions.value.find(item => item.locale === 'zh') ?? null)
const sourceStages = computed(() => source.value
  ? props.stages.filter(item => item.routeId === source.value?.id).sort((left, right) => left.order - right.order)
  : [])
const destination = computed(() => props.destinations.find(item => item.id === source.value?.destinationId) ?? null)
const sourceResult = computed<RouteChatResult | null>(() => source.value ? { route: source.value, stages: sourceStages.value } : null)

/** 目标语言：已创建的直接标出，未创建的默认勾选，便于一键补齐。 */
const targets = computed(() => contentLocales
  .filter(item => item.id !== 'zh')
  .map(item => {
    const existing = versions.value.find(version => version.locale === item.id) ?? null
    const reusable = sourceResult.value ? reusableStageCount(sourceStages.value, props.stages, item.id) : 0
    const preview = sourceResult.value
      ? buildLanguageVersion(sourceResult.value, item.id, props.ownerName, { destination: destination.value, library: props.stages }).route.name
      : ''
    return { locale: item.id, label: item.label, existing, reusable, preview }
  }))

const selected = ref<Locale[]>(targets.value.filter(item => !item.existing).map(item => item.locale))

function toggle(locale: Locale) {
  if (targets.value.find(item => item.locale === locale)?.existing) return
  selected.value = selected.value.includes(locale)
    ? selected.value.filter(item => item !== locale)
    : [...selected.value, locale]
}

/** 生成草稿状态的其它语言版本，可在列表中继续补译文并走审核上架流程。 */
function convert() {
  const current = sourceResult.value
  if (!current || !selected.value.length) return
  const entries = selected.value.map(locale => buildLanguageVersion(current, locale, props.ownerName, {
    destination: destination.value,
    library: props.stages,
  }))
  emit('created', entries)
}

function requestClose() { emit('close') }
function onKey(event: KeyboardEvent) { if (event.key === 'Escape') requestClose() }
onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="form-modal" @click.self="requestClose">
    <section class="form-dialog localize-dialog" role="dialog" aria-label="多语言转换">
      <header class="form-dialog-head">
        <div><span class="eyebrow">多语言</span><h3>多语言转换</h3><p>以中文源版本为基准，生成其它语言版本的路线记录。</p></div>
        <button class="icon-button" aria-label="关闭" @click="requestClose"><X :size="18" /></button>
      </header>

      <div class="form-dialog-body">
        <section class="localize-source">
          <div class="localize-source-head"><Languages :size="14" /><strong>中文源版本</strong><em>转换方向：中文 → 其他语言</em></div>
          <template v-if="source">
            <p class="localize-name">{{ source.name }}</p>
            <dl>
              <div><dt>编码</dt><dd>{{ source.code }}</dd></div>
              <div><dt>景点</dt><dd>{{ destination?.name ?? '—' }}</dd></div>
              <div><dt>站点</dt><dd>{{ sourceStages.length }} 个 · {{ source.estimatedMinutes }} 分钟</dd></div>
              <div><dt>已有语言</dt><dd>{{ versions.map(item => localeLabelOf(item.locale)).join(' / ') }}</dd></div>
            </dl>
          </template>
          <p v-else class="stage-error">该线路缺少中文源版本，请先创建中文路线后再做多语言转换。</p>
        </section>

        <section>
          <div class="localize-label">目标语言版本（默认勾选尚未创建的语言）</div>
          <div class="localize-targets">
            <button v-for="item in targets" :key="item.locale" type="button" :disabled="Boolean(item.existing)" :class="['localize-target', { active: selected.includes(item.locale), done: Boolean(item.existing) }]" @click="toggle(item.locale)">
              <span class="localize-target-head"><strong>{{ item.preview || item.label }}</strong><em>{{ item.existing ? `${item.label} · 已创建` : item.label }}</em></span>
              <small v-if="item.existing">已存在 {{ item.existing.code }}，如需改写可在列表中编辑。</small>
              <Check v-if="selected.includes(item.locale)" :size="15" />
            </button>
          </div>
        </section>

        <ul class="localize-notes">
          <li>复用中文源的停靠点与文化点，路线几何、里程与预计时长保持一致。</li>

          <li>生成的版本为草稿状态，可继续走「提交审核 → 上架」流程。</li>
        </ul>
      </div>

      <footer class="form-dialog-foot">
        <button class="button ghost" @click="requestClose">取消</button>
        <button class="button primary" :disabled="!source || !selected.length" @click="convert">开始转换<template v-if="selected.length">（{{ selected.length }} 个版本）</template></button>
      </footer>
    </section>
  </div>
</template>

<style scoped>
.localize-dialog{width:min(720px,94vw)}
.localize-source{padding:13px 14px;border:1px solid #30343a;border-radius:9px;background:#13161a}
.localize-source-head{display:flex;align-items:center;gap:8px;font-size:11px;color:#d8b45c}
.localize-source-head em{font-style:normal;margin-left:auto;font-size:9px;color:#8e969f}
.localize-name{margin:10px 0 0;font-size:13px;color:#f0f1f2}
.localize-source dl{margin:9px 0 0;display:grid;gap:6px}
.localize-source dl>div{display:flex;gap:8px;font-size:10px}
.localize-source dt{flex:none;color:#8e969f}
.localize-source dd{margin:0;min-width:0;color:#c8ced4;word-break:break-all}
.localize-label{font-size:11px;color:#8e969f}
.localize-targets{margin-top:9px;display:grid;grid-template-columns:1fr 1fr;gap:9px}
.localize-target{position:relative;display:grid;gap:6px;padding:11px 12px;border:1px solid #30343a;border-radius:9px;background:#13161a;color:#e6e9eb;text-align:left}
.localize-target-head{display:flex;flex-wrap:wrap;align-items:baseline;gap:8px}
.localize-target-head strong{font-size:12px}
.localize-target-head em{font-style:normal;font-size:9px;color:#8e969f}
.localize-target small{font-size:9px;line-height:1.7;color:#8e969f}
.localize-target>svg{position:absolute;right:11px;top:11px;color:#d8b65e}
.localize-target.active{border-color:#8a733f;background:#211d17}
.localize-target.active .localize-target-head em{color:#e4bc61}
.localize-target.done{border-style:dashed;opacity:.6;cursor:not-allowed}
.localize-target:disabled{cursor:not-allowed}
.localize-notes{list-style:none;margin:2px 0 0;padding:0;display:grid;gap:5px}
.localize-notes li{font-size:10px;line-height:1.75;color:#8e969f}
.localize-notes li::before{content:'·';margin-right:6px;color:#d8b45c}
@media(max-width:720px){.localize-targets{grid-template-columns:1fr}}
</style>
