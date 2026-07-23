<script setup lang="ts">
definePageMeta({
  middleware: 'admin-auth',
});
</script>

<template>
  <div class="mx-auto flex w-full max-w-[720px] flex-col items-center gap-3 px-4 py-16 text-center">
    <p class="text-base font-medium text-foreground">
      运营发布即将开放
    </p>
    <p class="text-sm leading-6 text-muted-foreground">
      此功能仍在准备中，暂无可用内容。请先使用「主题路线」完成创建、审核与上架。
    </p>
  </div>
</template>
