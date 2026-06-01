<script setup lang="ts">
interface Props {
  title: string;
  description: string;
  count: number;
  active: boolean;
}

defineProps<Props>();

const emit = defineEmits<{
  select: [];
}>();
</script>

<template>
  <button type="button" class="category-card" :class="{ 'category-card--active': active }" @click="emit('select')">
    <div class="category-card__head">
      <span class="category-card__title">{{ title }}</span>
      <span class="category-card__count">{{ count }}</span>
    </div>
    <div class="category-card__desc">{{ description }}</div>
  </button>
</template>

<style scoped lang="scss">
.category-card {
  width: 100%;
  border: 1px solid rgba(43, 131, 255, 0.28);
  border-radius: 4px;
  padding: 10px 12px;
  text-align: left;
  background: linear-gradient(180deg, rgba(3, 19, 41, 0.94) 0%, rgba(2, 15, 32, 0.96) 100%);
  box-shadow: 0 0 0 1px rgba(32, 111, 202, 0.22), 0 8px 20px rgba(1, 8, 18, 0.35);
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease,
    transform 0.18s ease;
  position: relative;
}

.category-card::before,
.category-card::after {
  content: '';
  position: absolute;
  width: 8px;
  height: 8px;
  pointer-events: none;
  z-index: 2;
  opacity: 0.35;
}

.category-card::before {
  top: -1px;
  left: -1px;
  border-top: 2px solid #29a3ff;
  border-left: 2px solid #29a3ff;
  border-radius: 4px 0 0 0;
}

.category-card::after {
  bottom: -1px;
  right: -1px;
  border-bottom: 2px solid #29a3ff;
  border-right: 2px solid #29a3ff;
  border-radius: 0 0 4px 0;
}

.category-card:hover {
  transform: translateY(-1px);
  border-color: rgba(58, 160, 255, 0.45);
  box-shadow:
    0 0 0 1px rgba(41, 163, 255, 0.12),
    0 10px 28px rgba(1, 8, 18, 0.4);
}

.category-card:hover::before,
.category-card:hover::after {
  opacity: 0.6;
}

.category-card--active {
  border-color: rgba(70, 176, 255, 0.5);
  box-shadow:
    0 0 0 1px rgba(41, 163, 255, 0.15),
    0 8px 24px rgba(1, 8, 18, 0.45),
    inset 2px 0 0 #29a3ff;
}

.category-card--active::before,
.category-card--active::after {
  opacity: 0.6;
}

.category-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.category-card__title {
  font-size: 13px;
  font-weight: 700;
  color: #eaf5ff;
  letter-spacing: 0.3px;
}

.category-card__count {
  min-width: 28px;
  height: 20px;
  padding: 0 8px;
  border-radius: 3px;
  background: rgba(41, 163, 255, 0.14);
  border: 1px solid rgba(41, 163, 255, 0.22);
  color: rgba(203, 227, 255, 0.82);
  text-align: center;
  font-size: 11px;
  font-weight: 600;
  line-height: 20px;
  font-variant-numeric: tabular-nums;
}

.category-card__desc {
  margin-top: 6px;
  font-size: 11px;
  line-height: 1.5;
  color: rgba(147, 196, 255, 0.62);
}
</style>
