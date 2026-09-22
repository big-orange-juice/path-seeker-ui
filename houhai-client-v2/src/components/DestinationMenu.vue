<script setup lang="ts">
import { Check, ChevronDown, LockKeyhole, MapPinned } from 'lucide-vue-next'
import type { Destination } from '../types'

defineProps<{ current: Destination | undefined; destinations: Destination[] }>()
const emit = defineEmits<{ select: [id: string] }>()
const isOpen = defineModel<boolean>({ default: false })

function select(destination: Destination) {
  if (destination.status === 'comingSoon') return
  isOpen.value = false
  emit('select', destination.id)
}
</script>

<template>
  <div class="destination-menu">
    <button class="destination-trigger" :aria-expanded="isOpen" aria-haspopup="menu" @click="isOpen = !isOpen">
      <MapPinned :size="15" />
      <span><small>当前探索地</small><strong>{{ current?.name ?? '选择探索地' }}</strong></span>
      <ChevronDown :size="14" :class="{ rotated: isOpen }" />
    </button>
    <div v-if="isOpen" class="destination-popover" role="menu" aria-label="选择探索地">
      <div class="popover-heading"><span>选择探索地</span><small>路线内容按地点独立管理</small></div>
      <button v-for="destination in destinations" :key="destination.id" class="destination-option" :class="{ selected: current?.id === destination.id, disabled: destination.status === 'comingSoon' }" :disabled="destination.status === 'comingSoon'" role="menuitem" @click="select(destination)">
        <span class="destination-icon"><MapPinned :size="15" /></span>
        <span class="destination-copy"><strong>{{ destination.name }}</strong><small>{{ destination.region }} · {{ destination.subtitle }}</small></span>
        <Check v-if="current?.id === destination.id" :size="15" class="selected-check" /><LockKeyhole v-else-if="destination.status === 'comingSoon'" :size="14" class="lock-icon" />
        <em v-if="destination.status === 'comingSoon'">筹备中</em>
      </button>
      <p class="popover-footnote">新增地点后，会在这里切换对应的地图、讲解和路线。</p>
    </div>
  </div>
</template>

<style scoped>
.destination-menu{position:relative}.destination-trigger{display:flex;align-items:center;gap:8px;min-width:185px;padding:8px 10px;background:#edf2ef;border:1px solid transparent;border-radius:10px;color:var(--ink);text-align:left}.destination-trigger:hover,.destination-trigger[aria-expanded=true]{border-color:#c7d9d0;background:#e7efeb}.destination-trigger>svg:first-child{color:var(--lake)}.destination-trigger>svg:last-child{margin-left:auto;transition:transform .16s}.destination-trigger>svg.rotated{transform:rotate(180deg)}.destination-trigger span{display:grid;gap:3px}.destination-trigger small{font-size:9px;color:var(--muted)}.destination-trigger strong{font-size:11px;font-weight:650}.destination-popover{position:absolute;top:calc(100% + 10px);right:0;width:330px;padding:12px;background:#fffffff7;border:1px solid var(--line);border-radius:14px;box-shadow:0 16px 45px #193c4022;z-index:50;backdrop-filter:blur(16px)}.popover-heading{display:flex;align-items:baseline;justify-content:space-between;padding:3px 5px 10px;border-bottom:1px solid var(--line)}.popover-heading span{font:600 14px var(--display)}.popover-heading small{font-size:9px;color:var(--muted)}.destination-option{position:relative;display:flex;align-items:center;gap:9px;width:100%;padding:12px 5px;border:0;border-bottom:1px solid #edf0ed;background:transparent;color:var(--ink);text-align:left}.destination-option:last-of-type{border-bottom:0}.destination-option:not(.disabled):hover{background:#eef4ef}.destination-option.selected{background:#e8f0eb}.destination-option.disabled{cursor:default;color:#9ca9a1}.destination-icon{display:grid;place-items:center;flex-shrink:0;width:31px;height:31px;border-radius:9px;background:#e0ebe5;color:var(--lake)}.disabled .destination-icon{background:#eef1ed;color:#9ca9a1}.destination-copy{display:grid;gap:5px;min-width:0}.destination-copy strong{font-size:12px}.destination-copy small{font-size:9px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.selected-check{margin-left:auto;color:var(--lake)}.lock-icon{margin-left:auto;color:#aeb8b0}.destination-option em{position:absolute;right:5px;bottom:9px;font-style:normal;font-size:8px;color:#9a8152;background:#f5ecd2;padding:3px 5px;border-radius:4px}.popover-footnote{font-size:9px;line-height:1.7;color:var(--muted);padding:9px 5px 2px;margin:3px 0 0;border-top:1px solid var(--line)}
@media(max-width:760px){.destination-trigger{min-width:0;padding:7px 8px}.destination-trigger span{max-width:112px}.destination-trigger strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.destination-popover{position:fixed;top:124px;left:15px;right:15px;width:auto}.popover-heading small{display:none}}
</style>
