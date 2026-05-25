import { computed, ref } from 'vue';
import {
  buildingEnvironmentItems,
  buildingFeatureBindings,
  buildingFloors,
  buildingForceCards,
  buildingMaterials,
  buildingRoamPoints,
  buildingRoamRoutes,
  buildingRooms,
  buildingTask,
  buildingTilesetSources
} from '@/mock/building';
import type { BuildingMaterial } from './types';

export function useBuilding() {
  const selectedSourceKey = ref(buildingTask.sourceKey);
  const selectedFloorId = ref(buildingFloors[0]?.id ?? '');
  const selectedRoomId = ref(buildingFloors[0]?.roomIds[0] ?? '');
  const selectedRouteId = ref(buildingRoamRoutes[0]?.id ?? '');

  const activeSource = computed(
    () => buildingTilesetSources.find(item => item.key === selectedSourceKey.value) ?? null
  );
  const activeFloor = computed(() => buildingFloors.find(item => item.id === selectedFloorId.value) ?? null);
  const roomsOfActiveFloor = computed(() => buildingRooms.filter(item => item.floorId === selectedFloorId.value));
  const activeRoom = computed(() => buildingRooms.find(item => item.id === selectedRoomId.value) ?? null);
  const activeRoute = computed(() => buildingRoamRoutes.find(item => item.id === selectedRouteId.value) ?? null);
  const activeRoutePoints = computed(() => buildingRoamPoints.filter(item => item.routeId === selectedRouteId.value));
  const roomMaterials = computed(() =>
    buildingMaterials.filter(item => !selectedRoomId.value || item.roomId === selectedRoomId.value)
  );
  const currentBinding = computed(
    () => buildingFeatureBindings.find(item => item.roomId === selectedRoomId.value) ?? null
  );

  function selectSource(key: string) {
    selectedSourceKey.value = key;
    buildingTask.sourceKey = key;
  }

  function selectFloor(floorId: string) {
    selectedFloorId.value = floorId;

    const firstRoomId = buildingFloors.find(item => item.id === floorId)?.roomIds[0];

    if (firstRoomId) {
      selectedRoomId.value = firstRoomId;
    }
  }

  function selectRoom(roomId: string) {
    selectedRoomId.value = roomId;

    const nextRoom = buildingRooms.find(item => item.id === roomId);

    if (nextRoom) {
      selectedFloorId.value = nextRoom.floorId;
    }
  }

  function selectRoute(routeId: string) {
    selectedRouteId.value = routeId;

    const firstPointRoomId = buildingRoamPoints.find(item => item.routeId === routeId)?.roomId;

    if (firstPointRoomId) {
      selectRoom(firstPointRoomId);
    }
  }

  function appendMaterial(payload: Omit<BuildingMaterial, 'id' | 'createdAt'>) {
    buildingMaterials.unshift({
      ...payload,
      id: `m-${Date.now()}`,
      createdAt: new Date().toLocaleString('zh-CN', { hour12: false })
    });
    buildingTask.materialCount = buildingMaterials.length;
  }

  return {
    buildingTask,
    buildingForceCards,
    buildingEnvironmentItems,
    buildingTilesetSources,
    buildingFloors,
    buildingRooms,
    buildingRoamRoutes,
    buildingRoamPoints,
    buildingMaterials,
    selectedSourceKey,
    selectedFloorId,
    selectedRoomId,
    selectedRouteId,
    activeSource,
    activeFloor,
    activeRoom,
    activeRoute,
    activeRoutePoints,
    roomsOfActiveFloor,
    roomMaterials,
    currentBinding,
    selectSource,
    selectFloor,
    selectRoom,
    selectRoute,
    appendMaterial
  };
}
