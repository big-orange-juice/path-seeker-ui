<script setup lang="ts">
definePageMeta({
  middleware: 'admin-auth',
});

const { collectionColumns, collectionFields, conceptRows } = useAdminContent();
</script>

<template>
  <div class="mx-auto flex w-full max-w-[1320px] flex-col gap-6">
    <AdminPageHeader
      eyebrow="collections"
      title="馆藏内容管理"
      description="后台先把文物、展厅、标签和媒体资源整理为标准化内容资产，后续谜题与路线才能稳定复用。"
    />

    <section class="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
      <AdminSectionCard title="馆藏数据结构建议" description="对应产品方案 7.1，用于约束后台录入字段。">
        <AdminSimpleTable :columns="collectionColumns" :rows="collectionFields" />
      </AdminSectionCard>

      <AdminSectionCard title="内容资产化原则" description="这部分决定后台内容模型的边界。">
        <AdminInfoList :items="conceptRows.slice(0, 3)" />
      </AdminSectionCard>
    </section>

    <AdminSectionCard title="录入优先级" description="建议先做能直接支撑路线编排与出题的字段，而不是一次性堆完整 CMS。">
      <div class="grid gap-3 md:grid-cols-3">
        <div class="rounded-xl border border-border bg-secondary/40 p-4">
          <p class="text-sm font-semibold text-foreground">第一层：基础识别</p>
          <p class="pt-2 text-xs leading-5 text-muted-foreground">
            名称、编号、年代、作者、材质、朝代、展厅、展柜号。
          </p>
        </div>
        <div class="rounded-xl border border-border bg-secondary/40 p-4">
          <p class="text-sm font-semibold text-foreground">第二层：内容表达</p>
          <p class="pt-2 text-xs leading-5 text-muted-foreground">
            封面图、细节图、音频讲解、故事摘要、标签、推荐停留时长。
          </p>
        </div>
        <div class="rounded-xl border border-border bg-secondary/40 p-4">
          <p class="text-sm font-semibold text-foreground">第三层：互动支撑</p>
          <p class="pt-2 text-xs leading-5 text-muted-foreground">
            线索要素、可观察细节、对比差异、可反转的剧情素材。
          </p>
        </div>
      </div>
    </AdminSectionCard>
  </div>
</template>
