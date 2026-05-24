<script setup lang="ts">
defineOptions({
  name: 'GlobalLogo'
});

interface Props {
  /** Whether to show the title */
  showTitle?: boolean;
}

withDefaults(defineProps<Props>(), {
  showTitle: true
});
</script>

<template>
  <RouterLink
    to="/"
    class="w-full flex-y-center nowrap-hidden"
    :class="showTitle ? 'justify-start gap-10px px-12px' : 'justify-center'"
  >
    <SystemLogo class="shrink-0 size-28px" />
    <h2 v-show="showTitle" class="brand-title min-w-0 flex-1 truncate">智能辅助决策系统</h2>
  </RouterLink>
</template>

<style scoped>
.brand-title {
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.4px;
  color: transparent;
  background: linear-gradient(90deg, rgb(var(--primary-400-color)), rgb(var(--primary-700-color)));
  background-clip: text;
  -webkit-background-clip: text;
  text-shadow: 0 6px 18px rgb(var(--primary-500-color) / 22%);
}
</style>
