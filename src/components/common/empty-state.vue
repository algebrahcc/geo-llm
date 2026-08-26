<script setup lang="ts">
import SvgIcon from '@/components/custom/svg-icon.vue';

defineOptions({ name: 'EmptyState' });

withDefaults(
  defineProps<{
    /** 图标（SvgIcon 支持的 mdi 名） */
    icon?: string;
    /** 主文案 */
    title?: string;
    /** 次要说明文案 */
    description?: string;
    /** 大尺寸（图标 64px + 更大间距） */
    large?: boolean;
    /** 绝对定位铺满父容器（需父容器 position: relative） */
    absolute?: boolean;
  }>(),
  { icon: 'mdi:inbox-outline' }
);
</script>

<template>
  <div class="empty-state" :class="{ 'empty-state--large': large, 'empty-state--absolute': absolute }">
    <div v-if="icon || $slots.icon" class="empty-state__icon">
      <slot name="icon">
        <SvgIcon :icon="icon" />
      </slot>
    </div>
    <p v-if="title || $slots.title" class="empty-state__title">
      <slot name="title">{{ title }}</slot>
    </p>
    <p v-if="description || $slots.description" class="empty-state__desc">
      <slot name="description">{{ description }}</slot>
    </p>
    <div v-if="$slots.action" class="empty-state__action">
      <slot name="action" />
    </div>
  </div>
</template>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 48px 20px;
  text-align: center;

  &--large {
    gap: 14px;
    padding: 64px 20px;
  }

  /* 覆盖在表格/地图容器之上时不参与布局 */
  &--absolute {
    position: absolute;
    inset: 0;
    padding: 0;
    pointer-events: none;
  }

  &__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 52px;
    height: 52px;
    font-size: 26px;
    border-radius: 16px;
    color: var(--empty-icon-color, rgba(98, 196, 255, 0.55));
    background: var(--empty-icon-bg, rgba(98, 196, 255, 0.08));
    border: 1px solid var(--empty-icon-border, rgba(98, 196, 255, 0.18));

    .empty-state--large & {
      width: 64px;
      height: 64px;
      font-size: 32px;
      border-radius: 18px;
    }
  }

  &__title {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--empty-title-color, var(--n-text-color, #eaf5ff));
  }

  &__desc {
    margin: 0;
    font-size: 12px;
    max-width: 360px;
    line-height: 1.6;
    color: var(--empty-desc-color, rgba(203, 227, 255, 0.5));
  }

  &__action {
    margin-top: 4px;
  }
}
</style>
