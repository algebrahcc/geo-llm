<script setup lang="ts">
import type { BuildingFloor, BuildingRoom, BuildingTilesetLoadState, BuildingTilesetSource } from './types';
import type { BuildingLayerItem, BuildingStageLayerKey } from './types-stage';

defineOptions({
  name: 'BuildingLayerStagePanel'
});

interface Props {
  layers: BuildingLayerItem[];
  collapsed: boolean;
  sources: BuildingTilesetSource[];
  activeSourceKey: string;
  activeSource: BuildingTilesetSource | null;
  loadState: BuildingTilesetLoadState;
  floors: BuildingFloor[];
  activeFloorId: string;
  rooms: BuildingRoom[];
  activeRoomId: string;
  activeRoom: BuildingRoom | null;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  changeLayer: [payload: { key: BuildingStageLayerKey; visible: boolean }];
  toggleCollapse: [];
  selectSource: [key: string];
  selectFloor: [floorId: string];
  selectRoom: [roomId: string];
  zoomToTileset: [];
}>();

const sourceOptions = props.sources.map(item => ({
  label: item.label,
  value: item.key
}));

function getRiskType(level: BuildingRoom['riskLevel']) {
  if (level === 'high') return 'error';
  if (level === 'medium') return 'warning';

  return 'success';
}
</script>

<template>
  <NCard :bordered="false" size="small" class="layer-panel" :class="[{ 'layer-panel--collapsed': collapsed }]">
    <template #header>
      <div class="panel-title-wrap">
        <div class="title-group">
          <SvgIcon icon="mdi:layers-triple-outline" class="panel-icon" />
          <span>图层与结构</span>
        </div>
        <NButton quaternary circle size="small" @click="emit('toggleCollapse')">
          <template #icon>
            <SvgIcon :icon="collapsed ? 'mdi:chevron-left' : 'mdi:chevron-right'" />
          </template>
        </NButton>
      </div>
    </template>

    <div v-if="!collapsed" class="panel-body">
      <div class="section">
        <div class="section-title">图层开关</div>
        <div class="layer-list">
          <div v-for="layer in layers" :key="layer.key" class="layer-item">
            <div class="layer-meta">
              <div class="layer-name">{{ layer.label }}</div>
              <div class="layer-desc">{{ layer.description }}</div>
            </div>
            <NSwitch
              :value="layer.visible"
              size="small"
              @update:value="emit('changeLayer', { key: layer.key, visible: $event })"
            />
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">数据源</div>
        <NSelect
          :options="sourceOptions"
          :value="activeSourceKey"
          placeholder="选择 3D Tiles 数据源"
          @update:value="emit('selectSource', $event)"
        />
        <div class="source-card">
          <div class="source-head">
            <span>{{ activeSource?.label || '未选择数据源' }}</span>
            <NTag size="small" :type="loadState.loaded ? 'success' : loadState.error ? 'error' : 'warning'">
              {{ loadState.loading ? '加载中' : loadState.loaded ? '已连接' : loadState.error ? '异常' : '待配置' }}
            </NTag>
          </div>
          <div class="source-desc">{{ activeSource?.description || '请选择本地样例或远程地址。' }}</div>
          <div class="source-desc">位置：{{ activeSource?.location || '--' }}</div>
          <div class="source-desc">状态：{{ activeSource?.statusText || loadState.error || '尚未加载' }}</div>
          <NButton size="small" tertiary type="primary" @click="emit('zoomToTileset')">定位模型</NButton>
        </div>
      </div>

      <div class="section">
        <div class="section-title">楼层结构</div>
        <NSpace :size="8" wrap>
          <NButton
            v-for="floor in floors"
            :key="floor.id"
            size="small"
            :type="floor.id === activeFloorId ? 'primary' : 'default'"
            :secondary="floor.id !== activeFloorId"
            @click="emit('selectFloor', floor.id)"
          >
            {{ floor.label }}
          </NButton>
        </NSpace>

        <div class="room-list">
          <div
            v-for="room in rooms"
            :key="room.id"
            class="room-item"
            :class="{ 'room-item--active': room.id === activeRoomId }"
            @click="emit('selectRoom', room.id)"
          >
            <div class="room-head">
              <span>{{ room.name }}</span>
              <NTag size="small" :type="getRiskType(room.riskLevel)">
                {{ room.riskLevel === 'high' ? '高' : room.riskLevel === 'medium' ? '中' : '低' }}
              </NTag>
            </div>
            <div class="room-desc">{{ room.summary }}</div>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">房间摘要</div>
        <div class="source-card">
          <div class="source-head">
            <span>{{ activeRoom?.name || '请选择房间' }}</span>
            <span class="risk-hint">{{ activeRoom?.useType || '--' }}</span>
          </div>
          <div class="source-desc">摘要：{{ activeRoom?.summary || '当前尚未选中具体房间。' }}</div>
          <div class="source-desc">Feature 绑定：{{ activeRoom?.featureId || '未绑定' }}</div>
        </div>
      </div>
    </div>
  </NCard>
</template>

<style scoped>
.layer-panel {
  width: 312px;
  max-height: min(720px, calc(100vh - 176px));
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(10, 16, 30, 0.82);
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.22);
  backdrop-filter: blur(16px);
  overflow: hidden;
}

.layer-panel--collapsed {
  width: 186px;
}

.panel-title-wrap,
.title-group,
.source-head,
.room-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.title-group {
  justify-content: flex-start;
}

.panel-icon {
  font-size: 16px;
  color: #2b6bff;
}

.panel-body,
.section,
.layer-list,
.room-list {
  display: flex;
  flex-direction: column;
}

.panel-body {
  gap: 14px;
  max-height: min(640px, calc(100vh - 260px));
  overflow-y: auto;
  padding-right: 2px;
}

.section {
  gap: 8px;
}

.section-title {
  font-size: 12px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.62);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.layer-list,
.room-list {
  gap: 10px;
  max-height: 240px;
  overflow-y: auto;
  padding-right: 2px;
}

.layer-item,
.source-card,
.room-item {
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  padding: 9px 10px;
  background: rgba(255, 255, 255, 0.03);
}

.layer-item {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.layer-meta {
  min-width: 0;
}

.layer-name {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.9);
}

.layer-desc,
.source-desc,
.room-desc,
.risk-hint {
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.7;
  color: rgba(255, 255, 255, 0.58);
}

.room-item {
  cursor: pointer;
  transition: all 0.18s ease;
}

.room-item--active {
  border-color: rgba(43, 107, 255, 0.38);
  background: rgba(43, 107, 255, 0.08);
}

.panel-body::-webkit-scrollbar,
.room-list::-webkit-scrollbar {
  width: 6px;
}

.panel-body::-webkit-scrollbar-thumb,
.room-list::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.12);
}
</style>
