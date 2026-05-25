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
    <div class="flex items-start justify-between gap-12px">
      <div>
        <div class="text-15px font-600 text-[#f5f7fa]">{{ title }}</div>
        <div class="mt-8px text-12px leading-18px text-[#94a3b8]">{{ description }}</div>
      </div>
      <div class="count-badge">{{ count }}</div>
    </div>
  </button>
</template>

<style scoped>
.category-card {
  color: var(--knowledge-title, #0f172a);
  width: 100%;
  border: 1px solid var(--knowledge-card-border, rgba(148, 163, 184, 0.2));
  border-radius: 18px;
  padding: 18px;
  text-align: left;
  background: var(--knowledge-card-bg, linear-gradient(135deg, rgba(15, 23, 42, 0.96), rgba(30, 41, 59, 0.92)));
  transition:
    border-color 0.18s ease,
    transform 0.18s ease,
    box-shadow 0.18s ease;
}

.category-card:hover {
  transform: translateY(-2px);
  border-color: rgba(96, 165, 250, 0.45);
  box-shadow: var(--knowledge-card-shadow, 0 16px 24px rgba(15, 23, 42, 0.2));
}

.category-card--active {
  border-color: rgba(59, 130, 246, 0.65);
  box-shadow: inset 0 0 0 1px rgba(59, 130, 246, 0.22);
}

.count-badge {
  min-width: 40px;
  border-radius: 999px;
  padding: 6px 12px;
  background: var(--knowledge-tag-bg, rgba(59, 130, 246, 0.16));
  color: var(--knowledge-tag-color, #bfdbfe);
  text-align: center;
  font-size: 12px;
  font-weight: 600;
}

.category-card :deep(.text-\[\#f5f7fa\]) {
  color: var(--knowledge-title, #0f172a) !important;
}

.category-card :deep(.text-\[\#94a3b8\]) {
  color: var(--knowledge-subtitle, #64748b) !important;
}
</style>
