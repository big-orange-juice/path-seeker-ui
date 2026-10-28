<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import Button from '@/components/shadcn/button/Button.vue'
import Input from '@/components/shadcn/input/Input.vue'
import PostcardTemplateDialog from '@/components/postcards/PostcardTemplateDialog.vue'
import type { PostcardTemplate } from '@/types/postcard'

definePageMeta({ middleware: 'admin-auth' })
const { request } = useApiClient()
const { data, pending, error, refresh } = useAsyncData('postcard-templates', () => request<PostcardTemplate[]>('/api/postcards/templates'), { default: () => [] })
const keyword = shallowRef('')
const editing = shallowRef<PostcardTemplate | null>(null)
const open = shallowRef(false)
const templates = computed(() => data.value.filter(item => item.name.includes(keyword.value.trim())))
function edit(item: PostcardTemplate | null) { editing.value = item; open.value = true }
</script>

<template>
  <div class="space-y-4"><div class="flex flex-wrap items-center gap-3"><Input v-model="keyword" class="max-w-xs" placeholder="搜索明信片模板" /><Button :disabled="pending" variant="outline" @click="refresh()">刷新</Button><Button @click="edit(null)">新增模板</Button></div>
    <p v-if="error" class="text-sm text-destructive">{{ error.message }}</p>
    <div class="overflow-x-auto rounded-lg border"><table class="w-full text-left text-sm"><thead class="border-b bg-muted/40"><tr><th class="p-3 font-medium">模板名称</th><th class="p-3 font-medium">用途</th><th class="p-3 font-medium">尺寸</th><th class="p-3 font-medium">状态</th><th class="p-3 font-medium">操作</th></tr></thead><tbody><tr v-for="item in templates" :key="item.id" class="border-b last:border-0"><td class="p-3">{{ item.name }}</td><td class="p-3">{{ item.mode === 'ai' ? '终点图生图' : '普通明信片' }}</td><td class="p-3">{{ item.width }} × {{ item.height }}</td><td class="p-3">{{ item.enabled ? '启用' : '停用' }}</td><td class="p-3"><Button size="sm" variant="outline" @click="edit(item)">编辑</Button></td></tr><tr v-if="!templates.length"><td colspan="5" class="p-6 text-center text-muted-foreground">{{ pending ? '加载中…' : '暂无模板' }}</td></tr></tbody></table></div>
    <PostcardTemplateDialog v-model:open="open" :template="editing" @saved="refresh()" />
  </div>
</template>
