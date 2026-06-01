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
}

.nav-panel__header {
  display: flex;
  align-items: center;
  height: 46px;
  padding: 0 14px;
  border-bottom: 1px solid rgba(25, 95, 176, 0.35);
  background: linear-gradient(180deg, rgba(10, 38, 72, 0.96) 0%, rgba(5, 25, 47, 0.96) 100%);
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
  background: linear-gradient(180deg, transparent, #29a3ff, transparent);
  opacity: 0.5;
}

.nav-panel__header-icon {
  font-size: 16px;
  color: #29a3ff;
  filter: drop-shadow(0 0 4px rgba(41, 163, 255, 0.25));
}

.nav-panel__header-title {
  margin-left: 8px;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.5px;
  color: #eaf5ff;
  text-shadow: 0 0 8px rgba(41, 163, 255, 0.12);
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
  background: rgba(48, 127, 212, 0.58);
}

.nav-panel__body::-webkit-scrollbar-track {
  background: rgba(4, 20, 40, 0.45);
}

.nav-group-title {
  font-size: 11px;
  font-weight: 600;
  color: #29a3ff;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  opacity: 0.8;
  padding: 0 4px;
}

.nav-item {
  width: 100%;
  border: 1px solid transparent;
  border-radius: 4px;
  padding: 8px 10px;
  text-align: left;
  background: transparent;
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    background 0.2s ease;
}

.nav-item:hover {
  background: linear-gradient(90deg, rgba(17, 79, 153, 0.16) 0%, rgba(8, 37, 74, 0.16) 100%);
  border-color: rgba(47, 133, 225, 0.22);
}

.nav-item--active {
  background: linear-gradient(90deg, rgba(19, 95, 182, 0.38) 0%, rgba(9, 46, 92, 0.16) 100%);
  border-color: rgba(61, 166, 255, 0.28);
  box-shadow: inset 2px 0 0 #29a3ff;
}

.nav-item__content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.nav-item__label {
  font-size: 13px;
  font-weight: 600;
  color: rgba(203, 227, 255, 0.82);
  line-height: 1.4;
}

.nav-item--active .nav-item__label {
  color: #fff;
}

.nav-item__count {
  min-width: 24px;
  height: 18px;
  padding: 0 6px;
  border-radius: 3px;
  background: rgba(41, 163, 255, 0.12);
  border: 1px solid rgba(41, 163, 255, 0.2);
  color: rgba(203, 227, 255, 0.82);
  text-align: center;
  font-size: 10px;
  font-weight: 600;
  line-height: 18px;
  font-variant-numeric: tabular-nums;
}

.nav-item__desc {
  margin-top: 3px;
  font-size: 11px;
  color: rgba(147, 196, 255, 0.5);
  line-height: 1.4;
}
</style>
