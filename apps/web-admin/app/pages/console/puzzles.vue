<script setup lang="ts">
definePageMeta({
  middleware: 'admin-auth',
});

const { puzzleWorkshopRows, ageColumns, ageStrategies, typeColumns, puzzleTypes } = useAdminContent();
</script>

<template>
  <div class="mx-auto flex w-full max-w-[1320px] flex-col gap-6">
    <AdminPageHeader
      eyebrow="puzzle workshop"
      title="谜题工坊"
      description="把单件馆藏转成可玩内容时，后台重点不是把题做多，而是让题型、分龄和审核逻辑可复用。"
    />

    <section class="grid gap-4 xl:grid-cols-[0.78fr_1.22fr]">
      <AdminSectionCard title="工坊设计要点" description="对应产品方案 7.2。">
        <AdminInfoList :items="puzzleWorkshopRows" />
      </AdminSectionCard>

      <AdminSectionCard title="分龄出题策略" description="后台需要同时控制认知跨度、交互复杂度与文案语气。">
        <AdminSimpleTable :columns="ageColumns" :rows="ageStrategies" />
      </AdminSectionCard>
    </section>

    <AdminSectionCard title="推荐题型库" description="这里先保留最贴近线下观展场景的高频题型。">
      <AdminSimpleTable :columns="typeColumns" :rows="puzzleTypes" />
    </AdminSectionCard>
  </div>
</template>
