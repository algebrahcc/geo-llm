import { computed, ref } from 'vue';
import {
  buildingDetail,
  buildingEnvironmentItems,
  buildingFeatureBindings,
  buildingBIMFloors,
  buildingEntrances,
  buildingFloors,
  buildingForceCards,
  buildingMaterials,
  buildingModelSources,
  buildingRoamPoints as buildingRoamPointList,
  buildingRoamRoutes,
  buildingRooms,
  buildingTask
} from '@/mock/building';
import type { BuildingMaterial, BuildingRoamPoint } from './types';

export function useBuilding() {
  const selectedSourceKey = ref(buildingTask.sourceKey);
  const selectedFloorId = ref(buildingFloors[0]?.id ?? '');
  const selectedRoomId = ref(buildingFloors[0]?.roomIds[0] ?? '');
  const selectedRouteId = ref(buildingRoamRoutes[0]?.id ?? '');

  // 使用 GLB 模型源（替代3D Tiles）
  const activeSource = computed(
    () => buildingModelSources.find(item => item.key === selectedSourceKey.value) ?? null
  );
  const activeFloor = computed(() => buildingFloors.find(item => item.id === selectedFloorId.value) ?? null);
  const roomsOfActiveFloor = computed(() => buildingRooms.filter(item => item.floorId === selectedFloorId.value));
  const activeRoom = computed(() => buildingRooms.find(item => item.id === selectedRoomId.value) ?? null);
  const activeRoute = computed(() => buildingRoamRoutes.find(item => item.id === selectedRouteId.value) ?? null);

  // 街景点位直接返回完整列表（不再按routeId过滤）
  const buildingRoamPoints = computed<BuildingRoamPoint[]>(() => buildingRoamPointList.map(p => ({
    id: p.id,
    title: p.title,
    entranceInfo: p.entranceInfo.replace(/\n/g, ' '),
    distance: p.distance,
    imageUrl: p.imageUrl || '',
    longitude: p.longitude,
    latitude: p.latitude
  })));

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
    buildingModelSources,
    buildingDetail,
    buildingBIMFloors,
    buildingEntrances,
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
