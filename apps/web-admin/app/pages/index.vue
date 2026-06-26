<script setup lang="ts">
const {
  adminMetrics,
  positioningRows,
  businessModelRows,
  conceptRows,
  bModuleColumns,
  bModules,
  cModuleColumns,
  cModules,
  flowStages,
} = useAdminContent();
</script>

<template>
  <div class="mx-auto flex w-full max-w-[1320px] flex-col gap-6">
    <AdminPageHeader
      eyebrow="overview"
      title="秘径寻踪后台概览"
      description="基于产品方案整理 B 端后台的信息架构，先明确产品定位、业务模型、核心理念与整体流程。"
    />

    <section class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <AdminMetricCard
        v-for="metric in adminMetrics"
        :key="metric.label"
        :label="metric.label"
        :value="metric.value"
        :note="metric.note"
        :icon="metric.icon"
      />
    </section>

    <section class="grid gap-4 xl:grid-cols-2">
      <AdminSectionCard title="项目定位" description="产品目标、核心价值与交付形态来自产品方案第 1 节。">
        <AdminInfoList :items="positioningRows" />
      </AdminSectionCard>

      <AdminSectionCard title="整体业务模型" description="区分博物馆管理者、策展人员与游客三类角色。">
        <AdminInfoList :items="businessModelRows" />
      </AdminSectionCard>
    </section>

    <section class="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
      <AdminSectionCard title="产品核心理念" description="后台设计优先服务内容资产化、路线游戏化与分龄适配。">
        <AdminInfoList :items="conceptRows" />
      </AdminSectionCard>

      <AdminSectionCard title="B / C 端功能全景" description="左侧是后台核心模块，右侧对应小程序的游戏化体验结构。">
        <div class="space-y-4">
          <AdminSimpleTable :columns="bModuleColumns" :rows="bModules" />
          <AdminSimpleTable :columns="cModuleColumns" :rows="cModules" />
        </div>
      </AdminSectionCard>
    </section>

    <AdminSectionCard title="核心业务流程" description="从内容准备到复盘运营，后台与小程序共享一条连续工作流。">
      <AdminStageList :stages="flowStages" />
    </AdminSectionCard>
  </div>
</template>
