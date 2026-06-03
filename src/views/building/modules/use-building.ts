import { computed, reactive, ref } from 'vue';
import {
  buildingDetail,
  buildingEnvironmentItems,
  buildingFeatureBindings,
  buildingBIMFloors,
  buildingEntrances,
  buildingFloors,
  buildingForceCards,
  buildingMaterials as mockBuildingMaterials,
  buildingModelSources,
  buildingRoamPoints as buildingRoamPointList,
  buildingRoamRoutes,
  buildingRooms,
  buildingTask as mockBuildingTask
} from '@/mock/building';
import type { BuildingMaterial, BuildingRoamPoint } from './types';

export function useBuilding() {
  // 本地 task 副本，避免直接修改 mock 单例
  const buildingTask = reactive({ ...mockBuildingTask });
  // 本地 materials 副本（浅拷贝数组，元素为引用）
  const buildingMaterials = reactive([...mockBuildingMaterials]);

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
  // 主入口计算属性（从 mock 文件中迁移过来，mock 只负责静态数据）
  const activePrimaryEntrance = computed(
    () => buildingEntrances.find(e => e.isPrimary) ?? buildingEntrances[0] ?? null
  );

  function selectSource(key: string) {
    selectedSourceKey.value = key;
    // 仅更新本地副本，不污染 mock 单例
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
    // 更新本地副本中的 materialCount，不直接写 mock 单例
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
    activePrimaryEntrance,
    selectSource,
    selectFloor,
    selectRoom,
    selectRoute,
    appendMaterial
  };
}
