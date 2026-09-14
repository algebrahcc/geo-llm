<script setup lang="ts">
import SvgIcon from '@/components/custom/svg-icon.vue';

interface CollectionItem {
  key: string;
  label: string;
  description: string;
  count: number;
}

interface CollectionGroup {
  group: string;
  items: CollectionItem[];
}

interface Props {
  groups: CollectionGroup[];
  activeKey: string;
}

defineProps<Props>();

const emit = defineEmits<{
  select: [key: string];
}>();
</script>

<template>
  <div class="nav-panel">
    <div class="nav-panel__header">
      <SvgIcon icon="mdi:book-open-variant" class="nav-panel__header-icon" />
      <span class="nav-panel__header-title">知识集合</span>
    </div>
    <div class="nav-panel__body">
      <div class="flex flex-col gap-12px">
        <div v-for="group in groups" :key="group.group">
          <div class="nav-group-title">{{ group.group }}</div>
          <div class="mt-4px flex flex-col gap-4px">
            <button
              v-for="item in group.items"
              :key="item.key"
              type="button"
              class="nav-item"
              :class="{ 'nav-item--active': activeKey === item.key }"
              @click="emit('select', item.key)"
            >
              <div class="nav-item__content">
                <span class="nav-item__label">{{ item.label }}</span>
                <span class="nav-item__count">{{ item.count }}</span>
              </div>
              <div class="nav-item__desc">{{ item.description }}</div>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.nav-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  font-family: 'Microsoft YaHei', 'PingFang SC', 'HarmonyOS Sans SC', 'Segoe UI', sans-serif;
  letter-spacing: 0.2px;
}

.nav-panel__header {
  display: flex;
  align-items: center;
  height: 46px;
  padding: 0 14px;
  border-bottom: 1px solid var(--ui-border-4);
  background: linear-gradient(180deg, var(--ui-surface-4) 0%, var(--ui-surface-5) 100%);
  position: relative;
}

/* Header left accent bar (catalog-style) */
.nav-panel__header::before {
  content: '';
  position: absolute;
  left: 0;
  top: 20%;
  bottom: 20%;
  width: 2px;
  border-radius: 1px;
  background: linear-gradient(180deg, transparent, var(--ui-accent-4), transparent);
  opacity: 0.5;
}

.nav-panel__header-icon {
  font-size: 18px;
  color: var(--ui-accent-4);
  filter: drop-shadow(0 0 4px var(--ui-border-40));
}

.nav-panel__header-title {
  margin-left: 8px;
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 0.5px;
  color: var(--ui-text-33);
  text-shadow: 0 0 8px var(--ui-border-7);
}

.nav-panel__body {
  flex: 1;
  min-height: 0;
  padding: 8px;
  overflow: auto;
}

.nav-panel__body::-webkit-scrollbar {
  width: 8px;
}

.nav-panel__body::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: var(--ui-accent-68);
}

.nav-panel__body::-webkit-scrollbar-track {
  background: var(--ui-surface-35);
}

.nav-group-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--ui-accent-4);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  opacity: 0.85;
  padding: 0 4px;
}

.nav-item {
  width: 100%;
  border: 1px solid transparent;
  border-radius: 4px;
  padding: 12px 14px;
  text-align: left;
  background: transparent;
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    background 0.2s ease;
}

.nav-item:hover {
  background: linear-gradient(90deg, var(--ui-border-66) 0%, var(--ui-surface-32) 100%);
  border-color: var(--ui-border-67);
}

.nav-item--active {
  background: linear-gradient(90deg, var(--ui-border-68) 0%, var(--ui-surface-33) 100%);
  border-color: var(--ui-accent-67);
  box-shadow: inset 2px 0 0 var(--ui-accent-4);
  position: relative;
  transition:
    border-color 0.2s ease,
    background 0.2s ease,
    box-shadow 0.2s ease;
}

.nav-item--active::after {
  content: '';
  position: absolute;
  right: 12px;
  top: 16px;
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: var(--ui-accent-4);
  box-shadow: 0 0 6px var(--ui-accent-122);
}

.nav-item__content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.nav-item__label {
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0.2px;
  color: var(--ui-text-76);
  line-height: 1.5;
}

.nav-item--active .nav-item__label {
  color: var(--ui-text-1);
}

.nav-item__count {
  min-width: 30px;
  height: 22px;
  padding: 0 8px;
  border-radius: 3px;
  background: var(--ui-border-7);
  border: 1px solid var(--ui-border-39);
  color: var(--ui-text-76);
  text-align: center;
  font-family: 'DIN', 'Consolas', monospace;
  font-size: 13px;
  font-weight: 600;
  line-height: 22px;
  font-variant-numeric: tabular-nums;
}

.nav-item__desc {
  margin-top: 5px;
  font-size: 14px;
  color: var(--ui-text-45);
  line-height: 1.5;
}
</style>
