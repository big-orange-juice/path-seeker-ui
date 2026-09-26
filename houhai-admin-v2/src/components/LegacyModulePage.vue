<script setup lang="ts">
import { computed, ref } from 'vue'
import { BarChart3, Plus, Search, UserRound, UsersRound, Volume2 } from 'lucide-vue-next'
type ModuleKey = 'analytics' | 'guides' | 'pronunciation' | 'users'
interface ModuleRow { id:string; name:string; subtitle:string; category:string; owner:string; count:string; status:string }
const props = defineProps<{ module: ModuleKey }>()
const emit = defineEmits<{ notify:[message:string] }>()
const keyword = ref('')
const configs: Record<ModuleKey,{title:string;description:string;action:string;columns:string[];rows:ModuleRow[]}> = {
  analytics:{title:'运营分析',description:'查看内容建设、路线发布与用户使用情况。',action:'导出报表',columns:['指标','业务分类','统计周期','当前数据','状态','操作'],rows:[
    {id:'a1',name:'路线完成率',subtitle:'用户开始路线后的完成比例',category:'路线运营',owner:'近 30 天',count:'68.4%',status:'正常'},
    {id:'a2',name:'讲解播放量',subtitle:'文化内容与讲解累计播放',category:'内容消费',owner:'近 30 天',count:'12,486',status:'增长'},
    {id:'a3',name:'活跃用户',subtitle:'产生浏览、播放或路线行为的用户',category:'用户活跃',owner:'近 7 天',count:'2,174',status:'正常'},
  ]},
  guides:{title:'导游管理',description:'管理导游账号、讲解内容与路线归属。',action:'新增导游',columns:['导游','账号类型','负责景点','内容数量','状态','操作'],rows:[
    {id:'g1',name:'顾远',subtitle:'guide-guyuan · 城市史学者',category:'签约导游',owner:'北京·后海',count:'5 版讲解',status:'已启用'},
    {id:'g2',name:'阿槐',subtitle:'guide-ahuai · 胡同故事家',category:'签约导游',owner:'北京·后海',count:'5 版讲解',status:'已启用'},
    {id:'g3',name:'林澄',subtitle:'guide-lincheng · 园林导览员',category:'馆方导游',owner:'北京·后海',count:'1 版讲解',status:'已启用'},
  ]},
  pronunciation:{title:'发音词典',description:'维护人名、地名与专业词汇的标准发音。',action:'新增词条',columns:['词条','拼音 / 发音','分类','使用内容','状态','操作'],rows:[
    {id:'p1',name:'什刹海',subtitle:'shí chà hǎi',category:'地名',owner:'后海讲解',count:'8 处引用',status:'已生效'},
    {id:'p2',name:'醇亲王府',subtitle:'chún qīn wáng fǔ',category:'历史名称',owner:'故居讲解',count:'2 处引用',status:'已生效'},
    {id:'p3',name:'银锭观山',subtitle:'yín dìng guān shān',category:'文化典故',owner:'银锭桥讲解',count:'3 处引用',status:'已生效'},
  ]},
  users:{title:'用户管理',description:'管理后台账号、角色与数据权限。',action:'新增用户',columns:['用户','角色','数据范围','最近登录','状态','操作'],rows:[
    {id:'u1',name:'系统管理员',subtitle:'admin · 超级管理员',category:'管理员',owner:'全部景点',count:'今天 09:42',status:'已启用'},
    {id:'u2',name:'周策划',subtitle:'zhoucehua · 内容运营',category:'运营人员',owner:'北京·后海',count:'昨天 18:20',status:'已启用'},
    {id:'u3',name:'陈导游',subtitle:'chenguide · 导游账号',category:'导游',owner:'北京·后海',count:'09-18 14:06',status:'已启用'},
  ]},
}
const config = computed(() => configs[props.module])
const rows = computed(() => config.value.rows.filter(row => `${row.name}${row.subtitle}${row.category}${row.owner}`.toLowerCase().includes(keyword.value.toLowerCase())))
const icon = computed(() => ({analytics:BarChart3,guides:UserRound,pronunciation:Volume2,users:UsersRound}[props.module]))
</script>

<template>
  <section class="legacy-module">
    <div class="legacy-heading"><div><h1>{{ config.title }}</h1><p>{{ config.description }}</p></div><button class="button primary" @click="emit('notify',`${config.action}操作已打开（Demo）`)"><Plus :size="15"/>{{ config.action }}</button></div>
    <div class="filter-bar"><div class="search-box"><Search :size="17"/><input v-model="keyword" :placeholder="`搜索${config.title}名称、编码或分类`"/></div><select><option>全部分类</option></select><select><option>全部状态</option></select><button class="button ghost" @click="keyword=''">重置筛选</button><button class="button ghost" @click="emit('notify','列表已刷新')">刷新</button></div>
    <div class="list-summary">共 {{ rows.length }} 条，当前第 1 / 1 页</div>
    <section class="table-card legacy-table"><div class="legacy-table-head"><span v-for="column in config.columns" :key="column">{{ column }}</span></div><article v-for="row in rows" :key="row.id"><div class="entity"><span class="entity-icon indoor"><component :is="icon" :size="18"/></span><div><strong>{{ row.name }}</strong><small>{{ row.subtitle }}</small></div></div><div class="cell-stack"><strong>{{ row.category }}</strong><small>标准分类</small></div><div class="cell-stack"><strong>{{ row.owner }}</strong><small>当前归属</small></div><div class="cell-stack"><strong>{{ row.count }}</strong><small>Mock 数据</small></div><div><span class="status enabled">{{ row.status }}</span></div><div class="row-actions"><button class="button secondary small" @click="emit('notify',`已打开“${row.name}”编辑操作`) ">编辑</button><button class="button text small">更多操作</button></div></article><div v-if="!rows.length" class="empty">没有符合筛选条件的数据</div></section>
  </section>
</template>
