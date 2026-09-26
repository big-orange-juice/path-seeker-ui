<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { Languages, Layers, MoreHorizontal } from 'lucide-vue-next'
import { localeLabelOf, siblingRoutes } from '../domain/content'
import type { TourRoute } from '../types'

const props = defineProps<{ route: TourRoute; routePool: TourRoute[] }>()
const emit = defineEmits<{ convert: []; notify: [message: string] }>()

const open = ref(false)
const position = ref({ top: 0, right: 0 })
const button = ref<HTMLButtonElement | null>(null)
const panel = ref<HTMLElement | null>(null)

const versions = computed(() => siblingRoutes(props.route, props.routePool))
/** 多语言转换的基准始终是中文源版本。 */
const source = computed(() => versions.value.find(item => item.locale === 'zh') ?? null)

function toggle(event: MouseEvent) {
  if (open.value) { open.value = false; return }
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  position.value = {
    top: Math.min(rect.bottom + 6, Math.max(window.innerHeight - 160, 12)),
    right: Math.max(window.innerWidth - rect.right, 12),
  }
  open.value = true
}
function close() { open.value = false }
function startConvert() {
  close()
  if (!source.value) { emit('notify', '该线路缺少中文源版本，暂不支持多语言转换'); return }
  emit('convert')
}
function showVersions() {
  close()
  emit('notify', `同线路共 ${versions.value.length} 个语言版本：${versions.value.map(item => localeLabelOf(item.locale)).join(' / ')}`)
}
function onDocumentClick(event: MouseEvent) {
  if (!open.value) return
  const target = event.target as Node
  if (panel.value?.contains(target) || button.value?.contains(target)) return
  close()
}
function onKey(event: KeyboardEvent) { if (event.key === 'Escape') close() }

onMounted(() => {
  document.addEventListener('click', onDocumentClick)
  window.addEventListener('keydown', onKey)
  // 表格滚动或窗口变化时收起浮层，避免菜单与按钮错位。
  window.addEventListener('scroll', close, true)
  window.addEventListener('resize', close)
})
onUnmounted(() => {
  document.removeEventListener('click', onDocumentClick)
  window.removeEventListener('keydown', onKey)
  window.removeEventListener('scroll', close, true)
  window.removeEventListener('resize', close)
})
</script>

<template>
  <button ref="button" class="button text small" :aria-expanded="open" @click.stop="toggle"><MoreHorizontal :size="15" />更多操作</button>
  <Teleport to="body">
    <div v-if="open" ref="panel" class="row-menu" role="menu" :style="{ top: `${position.top}px`, right: `${position.right}px` }">
      <button type="button" role="menuitem" :disabled="!source" :title="source ? '' : '该线路缺少中文源版本'" @click="startConvert">
        <Languages :size="14" />
        <span><strong>多语言转换</strong><small>中文源 → 其他语言版本</small></span>
      </button>
      <button type="button" role="menuitem" @click="showVersions">
        <Layers :size="14" />
        <span><strong>查看语言版本</strong><small>同线路共 {{ versions.length }} 个版本</small></span>
      </button>
    </div>
  </Teleport>
</template>

<style scoped>
.row-menu{position:fixed;z-index:1300;width:238px;display:grid;gap:2px;padding:6px;border:1px solid #30343a;border-radius:10px;background:#16191d;box-shadow:0 18px 40px #000000a6}
.row-menu button{display:flex;align-items:flex-start;gap:9px;padding:9px 10px;border:0;border-radius:7px;background:transparent;color:#e6e9eb;text-align:left}
.row-menu button>svg{margin-top:3px;color:#d8b45c}
.row-menu button span{display:grid;gap:3px;min-width:0}
.row-menu button strong{font-size:11px;font-weight:600}
.row-menu button small{font-size:9px;color:#8e969f}
.row-menu button:hover:not(:disabled){background:#1f242a}
.row-menu button:disabled{opacity:.45;cursor:not-allowed}
</style>
