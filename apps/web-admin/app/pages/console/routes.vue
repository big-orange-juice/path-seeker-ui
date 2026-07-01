<script setup lang="ts">
definePageMeta({
  middleware: 'admin-auth',
});

const { routeFilter, routeSearch, filteredThemeRoutes } = useAdminContent();
</script>

<template>
  <div class="mx-auto flex w-full max-w-[1320px] flex-col gap-6">
    <AdminPageHeader
      eyebrow="theme routes"
      title="主题路线与剧本编排"
      description="主题路线页承接剧情、副本节奏、章节结构和奖励机制，内容来自产品方案第 10 节的示例任务。"
    />

    <AdminSectionCard title="示例主题任务" description="用于展示后台如何管理不同年龄层的路线方案。">
      <div class="space-y-4">
        <AdminRouteFilterBar
          :filter="routeFilter"
          :search="routeSearch"
          @update:filter="routeFilter = $event"
          @update:search="routeSearch = $event"
        />

        <div class="grid gap-4 xl:grid-cols-2">
          <AdminThemeRouteCard
            v-for="route in filteredThemeRoutes"
            :key="route.id"
            :route="route"
          />
        </div>
      </div>
    </AdminSectionCard>
  </div>
</template>
