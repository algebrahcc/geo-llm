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
    <SystemLogo class="shrink-0 size-32px" />
    <h2 v-show="showTitle" class="brand-title min-w-0 flex-1">地理大模型辅助决策系统</h2>
  </RouterLink>
</template>

<style scoped>
.brand-title {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 1px;
  color: transparent;
  background: linear-gradient(90deg, #4a7dbd, #3d6fb4);
  background-clip: text;
  -webkit-background-clip: text;
  text-shadow: 0 6px 18px rgba(41, 182, 255, 0.18);
}
html.dark .brand-title {
  background: linear-gradient(90deg, #4a7dbd, #3d6fb4);
  background-clip: text;
  -webkit-background-clip: text;
}
</style>
