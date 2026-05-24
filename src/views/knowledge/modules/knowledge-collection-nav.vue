<script setup lang="ts">
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
  <NCard :bordered="false" class="collection-nav-card">
    <template #header>
      <div>
        <div class="text-15px font-600 text-[#f8fafc]">知识集合</div>
        <div class="mt-4px text-12px text-[#94a3b8]">按集合快速切换资料视图</div>
      </div>
    </template>

    <div class="flex flex-col gap-16px">
      <div v-for="group in groups" :key="group.group">
        <div class="group-title">{{ group.group }}</div>
        <div class="mt-8px flex flex-col gap-8px">
          <button
            v-for="item in group.items"
            :key="item.key"
            type="button"
            class="nav-item"
            :class="{ 'nav-item--active': activeKey === item.key }"
            @click="emit('select', item.key)"
          >
            <div class="flex items-start justify-between gap-8px">
              <div>
                <div class="text-13px font-600 text-[#e2e8f0]">{{ item.label }}</div>
                <div class="mt-4px text-12px leading-18px text-[#94a3b8]">{{ item.description }}</div>
              </div>
              <div class="nav-count">{{ item.count }}</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  </NCard>
</template>

<style scoped>
.collection-nav-card {
  position: sticky;
  top: 16px;
  border-radius: 22px;
  background: rgba(15, 23, 42, 0.82);
}

.group-title {
  color: #93c5fd;
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.nav-item {
  width: 100%;
  border: 1px solid rgba(148, 163, 184, 0.14);
  border-radius: 16px;
  padding: 12px 14px;
  text-align: left;
  background: rgba(30, 41, 59, 0.62);
  transition:
    border-color 0.18s ease,
    transform 0.18s ease,
    background-color 0.18s ease;
}

.nav-item:hover {
  transform: translateX(2px);
  border-color: rgba(96, 165, 250, 0.35);
}

.nav-item--active {
  background: rgba(37, 99, 235, 0.14);
  border-color: rgba(59, 130, 246, 0.5);
}

.nav-count {
  min-width: 32px;
  border-radius: 999px;
  padding: 4px 8px;
  background: rgba(59, 130, 246, 0.16);
  color: #bfdbfe;
  text-align: center;
  font-size: 12px;
  font-weight: 600;
}
</style>
