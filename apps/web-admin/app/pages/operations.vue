<script setup lang="ts">
const { operationColumns, operationMetrics, milestoneStages, mvpRows } = useAdminContent();
</script>

<template>
  <div class="mx-auto flex w-full max-w-[1320px] flex-col gap-6">
    <AdminPageHeader
      eyebrow="operations"
      title="运营发布与实施节奏"
      description="这页对应产品方案的指标、阶段实施建议和 MVP 范围，用于支撑后续版本规划。"
    />

    <section class="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
      <AdminSectionCard title="数据与运营指标" description="后台看板最先要服务参与度、完成度与内容质量。">
        <AdminSimpleTable :columns="operationColumns" :rows="operationMetrics" />
      </AdminSectionCard>

      <AdminSectionCard title="MVP 范围" description="控制第一版边界，避免后台和小程序同时过度扩张。">
        <AdminInfoList :items="mvpRows" />
      </AdminSectionCard>
    </section>

    <AdminSectionCard title="实施建议" description="按产品方案第 12 节拆成三个阶段，逐步沉淀平台能力。">
      <AdminStageList :stages="milestoneStages" />
    </AdminSectionCard>
  </div>
</template>
