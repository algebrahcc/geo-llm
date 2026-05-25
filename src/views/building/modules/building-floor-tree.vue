<script setup lang="ts">
import type { BuildingFloor, BuildingRoom } from './types';

defineOptions({
  name: 'BuildingFloorTree'
});

interface Props {
  floors: BuildingFloor[];
  rooms: BuildingRoom[];
  activeFloorId: string;
  activeRoomId: string;
}

defineProps<Props>();

const emit = defineEmits<{
  selectFloor: [floorId: string];
  selectRoom: [roomId: string];
}>();
</script>

<template>
  <div class="floor-tree">
    <div v-for="floor in floors" :key="floor.id" class="floor-block">
      <div
        class="floor-header"
        :class="{ 'floor-header--active': floor.id === activeFloorId }"
        @click="emit('selectFloor', floor.id)"
      >
        <span>{{ floor.label }}</span>
        <span class="text-12px text-text-3">{{ floor.summary }}</span>
      </div>

      <div class="room-items">
        <div
          v-for="room in rooms.filter(item => item.floorId === floor.id)"
          :key="room.id"
          class="room-item"
          :class="{ 'room-item--active': room.id === activeRoomId }"
          @click="emit('selectRoom', room.id)"
        >
          <span>{{ room.name }}</span>
          <span class="text-12px text-text-3">{{ room.useType }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.floor-tree {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.floor-block,
.room-item {
  border: 1px solid rgba(148, 163, 184, 0.14);
  border-radius: 12px;
}

.floor-header,
.room-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px;
  cursor: pointer;
}

.room-items {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 0 12px 12px;
}

.floor-header--active,
.room-item--active {
  border-color: rgba(43, 107, 255, 0.36);
  background: rgba(43, 107, 255, 0.08);
}
</style>
