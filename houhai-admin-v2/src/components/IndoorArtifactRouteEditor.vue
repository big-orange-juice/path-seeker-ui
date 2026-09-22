<script setup lang="ts">
import { computed, ref } from 'vue'
import { Landmark, Lock, Pencil, Play, RotateCcw, RotateCw, Send, Trash2, ZoomIn, ZoomOut } from 'lucide-vue-next'
import type { TourRoute } from '../types'

const props = defineProps<{ route: TourRoute }>()
const emit = defineEmits<{ close: []; publish: [] }>()
const activeIndex = ref(0)
const prompt = ref('')
const sentMessage = ref('')
const nodes = [
  { name:'大克鼎', subtitle:'青铜器', description:'西周晚期青铜重器，铭文记录了重要册命与土地赏赐。' },
  { name:'青铜棘刺纹尊', subtitle:'青铜器', description:'器身纹饰层次丰富，呈现早期礼制与铸造工艺。' },
  { name:'越王剑', subtitle:'兵器', description:'保存状态出色的青铜兵器，剑身纹饰与铭文清晰。' },
  { name:'练形十二生肖纹镜', subtitle:'铜镜', description:'十二生肖与传统时间观念在器物上的集中表达。' },
  { name:'铜鎏金阿育王塔', subtitle:'宗教艺术', description:'以鎏金工艺和塔式结构呈现佛教造像艺术。' },
]
const activeNode = computed(() => nodes[activeIndex.value]!)
function sendPrompt() { if (!prompt.value.trim()) return; sentMessage.value = prompt.value.trim(); prompt.value = '' }
</script>

<template>
  <div class="artifact-editor">
    <div class="artifact-main">
      <section class="node-canvas">
        <div class="node-actions"><button><Trash2 :size="14"/>删除</button><button class="gold"><Pencil :size="14"/>编辑</button></div>
        <div class="node-flow"><button v-for="(node,index) in nodes" :key="node.name" :class="['artifact-node',{active:index===activeIndex}]" @click="activeIndex=index"><span>{{ index+1 }}.</span>{{ node.name }}<small>解说导览</small></button></div>
        <div class="canvas-tools"><button><ZoomIn :size="15"/></button><button><ZoomOut :size="15"/></button><button><span>⌗</span></button><button><Lock :size="14"/></button></div>
      </section>

      <section class="phone-preview">
        <div class="phone-screen"><div class="phone-status"><b>9:41</b><span>▮▮</span></div><span class="audio-label">AUDIO GUIDE</span><h2>{{ activeNode.name }}</h2><p>{{ activeNode.subtitle }}</p><div class="artifact-visual"><Landmark :size="116" :stroke-width="1"/><span>{{ activeNode.name }}</span></div><small>点按放大</small><div class="audio-progress"><i></i></div><div class="audio-time"><span>0:00</span><span>-3:20</span></div><div class="audio-controls"><RotateCcw :size="27"/><button><Play :size="24" fill="currentColor"/></button><RotateCw :size="27"/><b>文</b></div><em>已暂停</em></div>
      </section>

      <section class="route-chat"><div class="chat-empty" v-if="!sentMessage"><strong>用对话编辑当前路线</strong><p>例如：给当前站点增加提示，或按主题补几个站点。</p></div><div v-else class="chat-result"><span>你的修改要求</span><p>{{ sentMessage }}</p><strong>已记录到当前文物节点，等待确认应用。</strong></div><div class="chat-composer"><span>路线　{{ props.route.name }}</span><textarea v-model="prompt" rows="3" placeholder="描述你想对当前路线或站点做的修改…" @keydown.enter.exact.prevent="sendPrompt"/><div><small>可粘贴图片 · Enter 发送 · Shift+Enter 换行</small><button @click="sendPrompt"><Send :size="16"/></button></div></div></section>
    </div>
    <footer class="artifact-footer"><button class="button ghost" @click="emit('close')">关闭</button><button class="button primary" @click="emit('publish')">{{ props.route.status==='published'?'保存':'上架' }}</button></footer>
  </div>
</template>
