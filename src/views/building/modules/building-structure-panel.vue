<script setup lang="ts">
import type { BuildingFloor, BuildingRoom, BuildingTilesetLoadState, BuildingTilesetSource } from './types';

defineOptions({
  name: 'BuildingStructurePanel'
});

interface Props {
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
  <NSpace vertical :size="16">
    <NCard :bordered="false" title="内部结构 BIM">
      <NSpace vertical :size="12">
        <NSelect
          :options="sourceOptions"
          :value="activeSourceKey"
          placeholder="选择 3D Tiles 数据源"
          @update:value="emit('selectSource', $event)"
        />

        <div class="source-item">
          <div class="source-name">
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
      </NSpace>
    </NCard>

    <NCard :bordered="false" title="楼层结构">
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
          <div class="room-header">
            <span>{{ room.name }}</span>
            <NTag size="small" :type="getRiskType(room.riskLevel)">
              {{ room.riskLevel === 'high' ? '高' : room.riskLevel === 'medium' ? '中' : '低' }}
            </NTag>
          </div>
          <div class="room-desc">{{ room.summary }}</div>
        </div>
      </div>
    </NCard>

    <NCard :bordered="false" title="建筑文本信息">
      <NSpace vertical :size="10">
        <div class="source-name">{{ activeRoom?.name || '请选择房间' }}</div>
        <div class="source-desc">用途：{{ activeRoom?.useType || '--' }}</div>
        <div class="source-desc">摘要：{{ activeRoom?.summary || '当前尚未选中具体房间。' }}</div>
        <div class="source-desc">Feature 绑定：{{ activeRoom?.featureId || '未绑定' }}</div>
      </NSpace>
    </NCard>
  </NSpace>
</template>

<style scoped>
.source-item,
.room-item {
  border: 1px solid rgba(148, 163, 184, 0.14);
  border-radius: 12px;
  padding: 12px;
}

.source-name,
.room-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-weight: 600;
}

.source-desc,
.room-desc {
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.7;
  color: var(--n-text-color-3);
}

.room-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 12px;
}

.room-item {
  cursor: pointer;
  transition: all 0.2s ease;
}

.room-item--active {
  border-color: rgba(43, 107, 255, 0.38);
  background: rgba(43, 107, 255, 0.08);
}
</style>
