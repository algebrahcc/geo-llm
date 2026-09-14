<script setup lang="ts">
defineOptions({
  name: 'GlobalLogo'
});

interface Props {
  /** Whether to show the title */
  showTitle?: boolean;
  /** 紧凑模式：用于侧边栏（容器宽度受限），图标与字号更小以保证系统名称完整显示 */
  compact?: boolean;
}

withDefaults(defineProps<Props>(), {
  showTitle: true,
  compact: false
});
</script>

<template>
  <RouterLink
    to="/"
    class="brand-logo w-full flex-y-center nowrap-hidden"
    :class="[
      showTitle ? (compact ? 'justify-start gap-8px px-10px' : 'justify-start gap-12px px-12px') : 'justify-center',
      compact ? 'brand-logo--compact' : ''
    ]"
  >
    <SystemLogo class="shrink-0" :class="compact ? 'size-24px' : 'size-32px'" />
    <h2 v-show="showTitle" class="brand-title min-w-0 flex-1">地理大模型辅助决策系统</h2>
  </RouterLink>
</template>

<style scoped>
/*
 * 系统名称：采用「两段式」极浅渐变（白 → 极浅蓝），不使用任何发光/光晕，
 * 保持干净克制的观感，仅靠高对比度保证可读性。
 * 注意：
 *  1. background-clip 必须写在 background 之后——background 简写会把
 *     background-clip 重置为 border-box，顺序颠倒会让文字变成实心色块；
 *  2. 不使用 text-shadow——字形由背景渐变填充时，text-shadow 会绘制在字形之上，
 *     相当于蒙一层雾面，反而更暗。
 */
.brand-title {
  --brand-title-a: #1f2937;
  --brand-title-b: #35659f;
  font-size: 20px;
  font-weight: 700;
  letter-spacing: 0.5px;
  line-height: 1.2;
  white-space: nowrap;
  color: transparent;
  background: linear-gradient(92deg, var(--brand-title-a) 0%, var(--brand-title-b) 100%);
  background-clip: text;
  -webkit-background-clip: text;
}

/* 深色顶栏：纯白 → 极浅蓝，最暗处对 #061426 对比度 ≈ 12:1 */
html.dark .brand-title {
  --brand-title-a: #ffffff;
  --brand-title-b: #d6e7ff;
}

/* 紧凑模式（侧边栏）：15px + 零字距，12 个汉字约 180px，
   在 248px 侧栏内（10px 内边距 + 24px 图标 + 8px 间距 → 可用 196px）可完整显示 */
.brand-logo--compact .brand-title {
  font-size: 15px;
  letter-spacing: 0;
}

/* hover：只把渐变尾段再提亮一档，不用发光 */
.brand-logo:hover .brand-title {
  --brand-title-a: #16283d;
  --brand-title-b: #2f5f9e;
}

html.dark .brand-logo:hover .brand-title {
  --brand-title-b: #eef6ff;
}
</style>
