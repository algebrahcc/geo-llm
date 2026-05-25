<script setup lang="ts">
import type { BuildingMaterial, BuildingRoamPoint, BuildingRoamRoute } from './types';

defineOptions({
  name: 'BuildingRoamPanel'
});

interface Props {
  routes: BuildingRoamRoute[];
  activeRouteId: string;
  activePoints: BuildingRoamPoint[];
  materials: BuildingMaterial[];
}

defineProps<Props>();

const emit = defineEmits<{
  selectRoute: [routeId: string];
  capture: [];
}>();
</script>

<template>
  <NCard :bordered="false" title="情景漫游面板">
    <div class="roam-layout">
      <div class="route-list">
        <div class="panel-label">漫游路线</div>
        <NSpace :size="8" wrap>
          <NButton
            v-for="route in routes"
            :key="route.id"
            size="small"
            :type="route.id === activeRouteId ? 'primary' : 'default'"
            :secondary="route.id !== activeRouteId"
            @click="emit('selectRoute', route.id)"
          >
            {{ route.name }}
          </NButton>
        </NSpace>
      </div>

      <div class="point-list">
        <div class="panel-label">关键点</div>
        <NTimeline size="medium">
          <NTimelineItem v-for="point in activePoints" :key="point.id" :title="point.title" :time="point.duration">
            {{ point.description }}
          </NTimelineItem>
        </NTimeline>
      </div>

      <div class="material-box">
        <div class="panel-label">材料沉淀</div>
        <div class="material-stats">当前已沉淀 {{ materials.length }} 条截图/讲解材料</div>
        <NButton type="primary" size="small" @click="emit('capture')">截图生成材料</NButton>
      </div>
    </div>
  </NCard>
</template>

<style scoped>
.roam-layout {
  display: grid;
  grid-template-columns: 1.2fr 1.6fr 0.9fr;
  gap: 16px;
}

.panel-label {
  margin-bottom: 12px;
  font-size: 13px;
  font-weight: 600;
}

.route-list,
.point-list,
.material-box {
  border: 1px solid rgba(148, 163, 184, 0.14);
  border-radius: 12px;
  padding: 14px;
}

.material-stats {
  margin-bottom: 12px;
  font-size: 12px;
  line-height: 1.7;
  color: var(--n-text-color-3);
}

@media (max-width: 1200px) {
  .roam-layout {
    grid-template-columns: 1fr;
  }
}
</style>
