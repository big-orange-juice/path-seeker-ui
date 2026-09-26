<script setup lang="ts">
import { computed, ref } from 'vue'
import { BookOpen, Pencil, Plus, RefreshCw, Search, Trash2 } from 'lucide-vue-next'
import { useDemoAdmin } from '../composables/useDemoAdmin'
import type { CollectionItem, PublishStatus } from '../types'
import CollectionExhibitDialog from './CollectionExhibitDialog.vue'

const { database, saveCollection, removeCollection, notify } = useDemoAdmin()
const keyword = ref('')
const categoryFilter = ref('all')
const statusFilter = ref<'all' | PublishStatus>('all')
const dialogOpen = ref(false)
const dialogMode = ref<'create' | 'edit'>('create')
const editing = ref<CollectionItem | null>(null)

const statusLabels: Record<PublishStatus, string> = { draft: '草稿', pending: '待审核', published: '已发布' }
const categories = computed(() => [...new Set(database.collections.map(item => item.category))].sort())

/** 新增时给出一份空白草稿，编码留空由弹窗自动建议。 */
function blankCollection(): CollectionItem {
  return {
    id: `7900000000000${String(Date.now()).slice(-5)}`, code: '', name: '',
    destinationId: database.destinations[0]?.id ?? '', kind: 'relic', category: '', era: '', material: '',
    location: '', recommendedMinutes: 10, description: '', imageUrl: null, guideVersions: 1, status: 'draft',
  }
}
const dialogInitial = computed(() => editing.value ?? blankCollection())
const rows = computed(() => database.collections.filter(item => {
  const haystack = `${item.name}${item.code}${item.category}`.toLowerCase()
  return haystack.includes(keyword.value.trim().toLowerCase())
    && (categoryFilter.value === 'all' || item.category === categoryFilter.value)
    && (statusFilter.value === 'all' || item.status === statusFilter.value)
}))

function destinationName(id: string) { return database.destinations.find(item => item.id === id)?.name ?? '—' }
function openCreate() { editing.value = null; dialogMode.value = 'create'; dialogOpen.value = true }
function openEdit(item: CollectionItem) { editing.value = item; dialogMode.value = 'edit'; dialogOpen.value = true }
function handleSave(draft: CollectionItem) { saveCollection(draft); dialogOpen.value = false; editing.value = null }
function handleRemove(item: CollectionItem) {
  if (!window.confirm(`确定删除“${item.name}”？删除后列表不再展示。`)) return
  removeCollection(item.id)
}
function resetFilters() { keyword.value = ''; categoryFilter.value = 'all'; statusFilter.value = 'all' }
</script>

<template>
  <section class="legacy-module">
    <div class="legacy-heading">
      <div><h1>内容</h1><p>维护文物、文化展示点和对应讲解内容。</p></div>
      <button class="button primary" @click="openCreate"><Plus :size="15" />新增内容</button>
    </div>

    <div class="filter-bar">
      <div class="search-box"><Search :size="17" /><input v-model="keyword" placeholder="搜索内容名称、编码或分类" /></div>
      <select v-model="categoryFilter"><option value="all">全部分类</option><option v-for="item in categories" :key="item" :value="item">{{ item }}</option></select>
      <select v-model="statusFilter"><option value="all">全部状态</option><option value="draft">草稿</option><option value="pending">待审核</option><option value="published">已发布</option></select>
      <button class="button ghost" @click="resetFilters">重置筛选</button>
      <button class="button ghost" @click="notify('内容列表已刷新')"><RefreshCw :size="14" />刷新</button>
    </div>

    <div class="list-summary">共 {{ rows.length }} 条，当前第 1 / 1 页</div>

    <section class="table-card legacy-table">
      <div class="legacy-table-head"><span>内容</span><span>所属景点</span><span>内容类型</span><span>讲解版本</span><span>状态</span><span>操作</span></div>
      <article v-for="item in rows" :key="item.id">
        <div class="entity">
          <span class="entity-icon indoor"><BookOpen :size="18" /></span>
          <div><strong>{{ item.name }}</strong><small>{{ item.code }} · {{ item.category || '未分类' }}</small></div>
        </div>
        <div class="cell-stack"><strong>{{ destinationName(item.destinationId) }}</strong><small>{{ item.kind === 'relic' ? '文物' : '文化点' }} · {{ item.era || '年代待补充' }}</small></div>
        <div class="cell-stack"><strong>{{ item.category || '未分类' }}</strong><small>{{ item.location || '位置待补充' }}</small></div>
        <div class="cell-stack"><strong>{{ item.guideVersions }} 版讲解</strong><small>建议停留 {{ item.recommendedMinutes }} 分钟</small></div>
        <div><span :class="['status', item.status]">{{ statusLabels[item.status] }}</span></div>
        <div class="row-actions">
          <button class="button secondary small" @click="openEdit(item)"><Pencil :size="13" />编辑</button>
          <button class="button text small" @click="handleRemove(item)"><Trash2 :size="13" />删除</button>
        </div>
      </article>
      <div v-if="!rows.length" class="empty">没有符合筛选条件的内容</div>
    </section>

    <CollectionExhibitDialog v-model:open="dialogOpen" :mode="dialogMode" :initial-value="dialogInitial" :destinations="database.destinations" @save="handleSave" />
  </section>
</template>
