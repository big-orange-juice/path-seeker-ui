<script setup lang="ts">
import { computed, ref } from 'vue'
import { BarChart3, BookOpen, Building2, CircleHelp, LogOut, Map, MapPinned, MoreHorizontal, Plus, Route, Search, UserRound, UsersRound, Volume2 } from 'lucide-vue-next'
import DestinationWorkspace from './components/DestinationWorkspace.vue'
import GalleryMapPage from './components/GalleryMapPage.vue'
import LegacyModulePage from './components/LegacyModulePage.vue'
import RouteWorkspace from './components/RouteWorkspace.vue'
import { useDemoAdmin } from './composables/useDemoAdmin'
import type { Destination, SceneType, TourRoute } from './types'

type LegacyPageKey = 'analytics' | 'collections' | 'guides' | 'pronunciation' | 'users'
type PageKey = LegacyPageKey | 'destinations' | 'maps' | 'routes'
const pageLabels: Record<PageKey,string> = { analytics:'运营分析',destinations:'博物馆',collections:'馆藏内容',maps:'展厅地图',guides:'导游管理',routes:'主题路线',pronunciation:'发音词典',users:'用户管理' }
const { database, toast, saveDestination, savePlace, saveNarration, saveRoute, setRouteStatus, notify } = useDemoAdmin()
const page = ref<PageKey>('routes')
const keyword = ref('')
const sceneFilter = ref<'all'|SceneType>('all')
const destinationFilter = ref('all')
const activeDestination = ref<Destination | null>(null)
const activeRoute = ref<TourRoute | null>(null)

const destinationRows = computed(() => database.destinations.filter(item => (sceneFilter.value==='all'||item.sceneType===sceneFilter.value) && `${item.name}${item.code}${item.address}`.toLowerCase().includes(keyword.value.toLowerCase())))
const routeRows = computed(() => database.routes.filter(item => (sceneFilter.value==='all'||item.sceneType===sceneFilter.value) && (destinationFilter.value==='all'||item.destinationId===destinationFilter.value) && `${item.name}${item.code}${item.theme}`.toLowerCase().includes(keyword.value.toLowerCase())))
const workspacePlaces = computed(() => activeDestination.value ? database.places.filter(item => item.destinationId===activeDestination.value?.id) : [])
const workspaceSpaces = computed(() => activeDestination.value ? database.indoorSpaces.filter(item => item.destinationId===activeDestination.value?.id) : [])
const routeDestination = computed(() => activeRoute.value ? database.destinations.find(item=>item.id===activeRoute.value?.destinationId) ?? null : null)
const routePlaces = computed(() => activeRoute.value ? database.places.filter(item=>item.destinationId===activeRoute.value?.destinationId) : [])
const indoorNames = computed(() => Object.fromEntries(database.indoorSpaces.map(item=>[item.id,item.name])))
const currentPageLabel = computed(() => pageLabels[page.value])
const legacyPage = computed(() => page.value as LegacyPageKey)
function destinationName(id:string) { return database.destinations.find(item=>item.id===id)?.name ?? '—' }
function switchPage(value:PageKey) { page.value=value;keyword.value='';sceneFilter.value='all' }
function quickStatus(route:TourRoute) { if(route.status==='draft') setRouteStatus(route.id,'pending'); else if(route.status==='pending') setRouteStatus(route.id,'published'); else setRouteStatus(route.id,'draft') }
</script>

<template>
  <div class="admin-shell">
    <aside class="sidebar">
      <div class="brand"><div><strong>Path Seeker</strong><span>PATH SEEKER MUSEUM</span></div><b>{{ currentPageLabel }}</b></div>
      <nav class="main-nav">
        <button :class="{active:page==='analytics'}" @click="switchPage('analytics')"><BarChart3 :size="17"/>运营分析</button>
        <button :class="{active:page==='destinations'}" @click="switchPage('destinations')"><Building2 :size="17"/>博物馆</button>
        <button :class="{active:page==='collections'}" @click="switchPage('collections')"><BookOpen :size="17"/>馆藏内容</button>
        <button :class="{active:page==='maps'}" @click="switchPage('maps')"><Map :size="17"/>展厅地图</button>
        <button :class="{active:page==='guides'}" @click="switchPage('guides')"><UserRound :size="17"/>导游管理</button>
        <button :class="{active:page==='routes'}" @click="switchPage('routes')"><Route :size="17"/>主题路线</button>
        <button :class="{active:page==='pronunciation'}" @click="switchPage('pronunciation')"><Volume2 :size="17"/>发音词典</button>
        <button :class="{active:page==='users'}" @click="switchPage('users')"><UsersRound :size="17"/>用户管理</button>
      </nav>
    </aside>

    <main class="main-area">
      <header class="topbar"><div class="tab-trail"><span><BarChart3 :size="14"/>运营分析</span><strong>{{ currentPageLabel }}<i>×</i></strong></div><div class="top-actions"><button class="help"><CircleHelp :size="15"/>使用提示</button><div class="user"><UserRound :size="18"/><div><strong>系统管理员</strong><small>管理员</small></div></div><button class="logout"><LogOut :size="14"/>退出</button></div></header>
      <div class="page-content">
        <template v-if="page==='destinations'||page==='routes'">
        <section class="filter-bar"><select v-if="page==='routes'" v-model="destinationFilter"><option value="all">所属博物馆：全部</option><option v-for="item in database.destinations" :key="item.id" :value="item.id">{{ item.name }}</option></select><select v-else v-model="sceneFilter"><option value="all">全部博物馆类型</option><option value="outdoor">户外漫游</option><option value="indoor">场馆探索</option></select><div class="search-box"><Search :size="17"/><input v-model="keyword" :placeholder="page==='destinations'?'搜索博物馆名称、编码、地址':'搜索路线标题、编码、主题'"/></div><select v-if="page==='routes'" v-model="sceneFilter"><option value="all">全部路线类型</option><option value="outdoor">户外漫游</option><option value="indoor">场馆探索</option></select><button v-if="page==='routes'" class="button ghost" @click="sceneFilter='all'">待审核</button><button class="button primary" @click="notify(page==='destinations'?'已打开新增博物馆流程（Demo）':'已打开路线创建流程（Demo）')"><Plus :size="16"/>{{ page==='destinations'?'新增博物馆':'新增路线' }}</button><button class="button ghost" @click="keyword='';sceneFilter='all';destinationFilter='all'">重置筛选</button><button class="button ghost">刷新</button></section>
        <div class="list-summary">共 {{ page==='destinations'?destinationRows.length:routeRows.length }} 条，当前第 1 / 1 页</div>

        <section v-if="page==='destinations'" class="table-card">
          <div class="table-head"><span>博物馆</span><span>类型</span><span>内容规模</span><span>地图配置</span><span>状态</span><span>操作</span></div>
          <article v-for="item in destinationRows" :key="item.id" class="table-row destination-row"><div class="entity"><span :class="['entity-icon',item.sceneType]"><MapPinned v-if="item.sceneType==='outdoor'" :size="19"/><Building2 v-else :size="19"/></span><div><strong>{{ item.name }}</strong><small>{{ item.code }} · {{ item.address }}</small></div></div><div><span :class="['scene-badge',item.sceneType]">{{ item.sceneType==='outdoor'?'户外漫游':'场馆探索' }}</span></div><div class="cell-stack"><strong>{{ item.sceneType==='outdoor'?item.placeIds.length:item.indoorSpaceIds.length }} 个{{ item.sceneType==='outdoor'?'文化点':'空间' }}</strong><small>{{ database.routes.filter(route=>route.destinationId===item.id).length }} 条路线</small></div><div class="cell-stack"><strong>{{ item.mapProvider }}</strong><small>{{ item.coordinateSystem }} · {{ item.longitude.toFixed(3) }}, {{ item.latitude.toFixed(3) }}</small></div><div><span class="status enabled">已启用</span></div><div class="row-actions"><button class="button secondary small" @click="activeDestination=item">进入工作台</button><button class="icon-button"><MoreHorizontal :size="17"/></button></div></article>
          <div v-if="!destinationRows.length" class="empty">没有符合筛选条件的目的地</div>
        </section>

        <section v-else class="table-card">
            <div class="table-head route-columns"><span>路线</span><span>所属博物馆</span><span>站点数</span><span>创建人</span><span>状态</span><span>操作</span></div>
          <article v-for="route in routeRows" :key="route.id" class="table-row route-columns"><div class="entity"><span :class="['entity-icon',route.sceneType]"><Route :size="19"/></span><div><strong>{{ route.name }}</strong><small>{{ route.code }} · {{ route.theme }}</small></div></div><div class="cell-stack"><strong>{{ destinationName(route.destinationId) }}</strong><small>{{ route.sceneType==='outdoor'?'户外漫游':'场馆探索' }}</small></div><div class="cell-stack"><strong>{{ route.stops.length }} 个节点</strong><small>{{ route.estimatedMinutes }} 分钟<span v-if="route.sceneType==='outdoor'"> · {{ route.distanceKm }} km</span></small></div><div class="cell-stack"><strong>{{ route.ownerName }}</strong><small>内容运营</small></div><div><span :class="['status',route.status]">{{ route.status==='published'?'已上架':route.status==='pending'?'待审核':'未上架' }}</span><small v-if="route.auditRemark" class="audit-note">{{ route.auditRemark }}</small></div><div class="row-actions"><button :class="['button','small',route.status==='published'?'ghost':'primary']" @click="quickStatus(route)">{{ route.status==='published'?'下线':route.status==='pending'?'审核':'上架' }}</button><button class="button secondary small" @click="activeRoute=route">编辑</button><button class="button text small">更多操作</button></div></article>
          <div v-if="!routeRows.length" class="empty">没有符合筛选条件的路线</div>
        </section>
        </template>
        <GalleryMapPage v-else-if="page==='maps'" :destinations="database.destinations" :places="database.places" @notify="notify" />
        <LegacyModulePage v-else :module="legacyPage" @notify="notify" />
      </div>
    </main>

    <DestinationWorkspace v-if="activeDestination" :destination="activeDestination" :places="workspacePlaces" :indoor-spaces="workspaceSpaces" @close="activeDestination=null" @save-destination="saveDestination" @save-place="savePlace" @save-narration="saveNarration"/>
    <RouteWorkspace v-if="activeRoute&&routeDestination" :route="activeRoute" :destination="routeDestination" :places="routePlaces" :indoor-names="indoorNames" @close="activeRoute=null" @save="saveRoute"/>
    <Transition name="toast"><div v-if="toast" class="toast"><i></i>{{ toast }}</div></Transition>
  </div>
</template>
