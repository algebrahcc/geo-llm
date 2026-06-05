import { reactive, shallowRef } from 'vue';
import { useCesiumBase } from '@/composables/cesium/use-cesium-base';
import {
  Cartesian2,
  Cartesian3,
  Cartographic,
  Color,
  Entity,
  Math as CesiumMath,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType
} from 'cesium';
import type {
  BuildingFloor,
  BuildingRoamPoint,
  BuildingRoom,
  BuildingModelLoadState,
  BuildingModelSource
} from './types';
import type { BuildingInteractiveTool, BuildingStageLayerKey, BuildingStageStatusInfo } from './types-stage';

interface UseBuildingModelOptions {
  onRoomPicked?: (roomId: string) => void;
  onStatusChange?: (status: BuildingStageStatusInfo) => void;
}

function normalizeUrl(url: string) {
  return url.trim();
}

function getRiskColor(level: BuildingRoom['riskLevel']) {
  if (level === 'high') return '#fb7185';
  if (level === 'medium') return '#fbbf24';
  return '#2ee59d';
}

export function useBuildingModel(options: UseBuildingModelOptions = {}) {
  const base = useCesiumBase();
  const { containerRef, viewerRef } = base;

  const modelEntityRef = shallowRef<Entity | null>(null);
  const roomMarkerEntities = shallowRef<string[]>([]);
  const roamPointEntities = shallowRef<string[]>([]);

  const status = reactive<BuildingStageStatusInfo>({
    longitude: '--',
    latitude: '--',
    altitude: '--',
    cameraHeight: '--',
    activeTool: '浏览',
    sourceLabel: '--',
    loadStatus: '待命'
  });

  const loadState = reactive<BuildingModelLoadState>({
    sourceKey: '',
    sourceLabel: '',
    loading: false,
    loaded: false,
    error: ''
  });

  const layerVisibility: Record<BuildingStageLayerKey, boolean> = {
    imagery: true,
    model: true,
    rooms: true,
    'route-points': true
  };

  const roomCoordinateMap = new Map<string, { longitude: number; latitude: number; height: number }>();
  const pointCoordinateMap = new Map<string, { longitude: number; latitude: number; height: number }>();

  let activeTool: BuildingInteractiveTool = 'browse';
  let currentSource: BuildingModelSource | null = null;
  let currentFloors: BuildingFloor[] = [];
  let modelPosition: Cartesian3 | null = null;

  const toolNameMap: Record<BuildingInteractiveTool, string> = {
    browse: '浏览',
    'focus-building': '定位楼宇',
    'pick-room': '房间点选',
    'measure-distance': '距离测量',
    'measure-area': '面积测量'
  };

  function getLoadStatusText() {
    if (loadState.loading) return '加载中';
    if (loadState.error) return '异常';
    if (loadState.loaded) return '已连接';
    return '待命';
  }

  function emitStatus(cartesian?: Cartesian3 | null) {
    const viewer = viewerRef.value;
    if (!viewer) return;

    const cameraHeight = viewer.camera.positionCartographic.height;
    let longitude = '--';
    let latitude = '--';
    let altitude = '--';

    if (cartesian) {
      const cartographic = Cartographic.fromCartesian(cartesian);
      longitude = CesiumMath.toDegrees(cartographic.longitude).toFixed(4);
      latitude = CesiumMath.toDegrees(cartographic.latitude).toFixed(4);
      altitude = `${Math.max(cartographic.height, 0).toFixed(0)} m`;
    }

    status.longitude = longitude;
    status.latitude = latitude;
    status.altitude = altitude;
    status.cameraHeight = `${(cameraHeight / 1000).toFixed(1)} km`;
    status.activeTool = toolNameMap[activeTool];
    status.sourceLabel = loadState.sourceLabel || '--';
    status.loadStatus = getLoadStatusText();

    options.onStatusChange?.({ ...status });
  }

  function getBaseTransform(transform?: BuildingModelSource['transform']) {
    return {
      longitude: transform?.longitude ?? 121.5082,
      latitude: transform?.latitude ?? 25.0376,
      height: transform?.height ?? 0
    };
  }

  function getRoomCoordinate(room: BuildingRoom, roomIndex: number) {
    const floorIndex = Math.max(
      currentFloors.findIndex(item => item.id === room.floorId),
      0
    );
    const baseTransform = getBaseTransform(currentSource?.transform);

    return {
      longitude: baseTransform.longitude - 0.00045 + floorIndex * 0.00008 + roomIndex * 0.00015,
      latitude: baseTransform.latitude - 0.0003 + floorIndex * 0.00012 + roomIndex * 0.00005,
      height: baseTransform.height + 14 + floorIndex * 16 + roomIndex * 4
    };
  }

  // ─── 初始化 ───────────────────────────────────────

  async function initViewer() {
    await base.initViewer({
      prepareViewer(viewer) {
        viewer.scene.globe.showGroundAtmosphere = false;
        if (viewer.scene.skyAtmosphere) {
          viewer.scene.skyAtmosphere.show = false;
        }
        viewer.scene.globe.baseColor = Color.fromCssColorString('#07101d');
        viewer.scene.screenSpaceCameraController.minimumZoomDistance = 10;
        viewer.scene.screenSpaceCameraController.maximumZoomDistance = 40000000;
        viewer.scene.screenSpaceCameraController.zoomFactor = 1.2;
        viewer.scene.screenSpaceCameraController.inertiaZoom = 0.35;
        (viewer.cesiumWidget.creditContainer as HTMLElement).style.display = 'none';
      },
      afterImagery(viewer) {
        // 绑定事件（楼宇模块自己管理 ScreenSpaceEventHandler）
        const eventHandler = new ScreenSpaceEventHandler(viewer.scene.canvas);
        eventHandler.setInputAction((movement: { endPosition: Cartesian2 }) => {
          emitStatus(viewer.camera.pickEllipsoid(movement.endPosition, viewer.scene.globe.ellipsoid));
        }, ScreenSpaceEventType.MOUSE_MOVE);

        eventHandler.setInputAction((click: { position: Cartesian2 }) => {
          const picked = viewer.scene.pick(click.position);
          const entityId: unknown = picked?.id?.id;
          const roomId = typeof entityId === 'string' && entityId.startsWith('building-room-')
            ? entityId.slice('building-room-'.length)
            : null;

          if (roomId) {
            activeTool = 'pick-room';
            options.onRoomPicked?.(roomId);
            emitStatus(viewer.camera.pickEllipsoid(click.position, viewer.scene.globe.ellipsoid));
          }
        }, ScreenSpaceEventType.LEFT_CLICK);

        base.addCameraChangeListener(() => emitStatus());
        emitStatus();
      }
    });
  }

  // ─── 标记管理 ─────────────────────────────────────

  function clearMarkers() {
    const viewer = viewerRef.value;
    if (!viewer) return;

    roomMarkerEntities.value.forEach(id => { viewer.entities.removeById(id); });
    roamPointEntities.value.forEach(id => { viewer.entities.removeById(id); });
    roomMarkerEntities.value = [];
    roamPointEntities.value = [];
    roomCoordinateMap.clear();
    pointCoordinateMap.clear();
  }

  function unloadModel() {
    const viewer = viewerRef.value;
    if (!viewer) return;

    clearMarkers();

    if (modelEntityRef.value) {
      viewer.entities.remove(modelEntityRef.value);
      modelEntityRef.value = null;
      modelPosition = null;
    }

    loadState.loaded = false;
    base.requestRender();
  }

  async function loadModel(source: BuildingModelSource) {
    const viewer = viewerRef.value;
    const modelUrl = normalizeUrl(source.modelUrl);

    if (!viewer) return;

    currentSource = source;
    loadState.sourceKey = source.key;
    loadState.sourceLabel = source.label;
    loadState.loading = true;
    loadState.loaded = false;
    loadState.error = '';
    emitStatus();

    unloadModel();

    if (!modelUrl) {
      loadState.loading = false;
      loadState.error = 'GLB 模型地址未配置。';
      emitStatus();
      return;
    }

    try {
      const { longitude, latitude, height } = source.transform;
      const position = Cartesian3.fromDegrees(longitude, latitude, height);

      const entity = viewer.entities.add({
        id: `building-model-${source.key}`,
        name: source.label,
        position,
        model: {
          uri: modelUrl,
          scale: source.transform.scale ?? 1,
          minimumPixelSize: 128,
          maximumScale: (source.transform.scale ?? 1) * 2
        }
      });

      modelEntityRef.value = entity as any;
      entity.show = layerVisibility.model;
      loadState.loaded = true;
      modelPosition = position;
      base.requestRender();

      viewer.camera.flyTo({
        destination: Cartesian3.fromDegrees(longitude, latitude - 0.0003, 50),
        orientation: {
          heading: CesiumMath.toRadians(0),
          pitch: CesiumMath.toRadians(-35),
          roll: 0
        },
        duration: 0
      });
    } catch (error) {
      loadState.error = error instanceof Error ? error.message : 'GLB 模型加载失败';
    } finally {
      loadState.loading = false;
      emitStatus();
      base.requestRender();
    }
  }

  // ─── 镜头控制 ─────────────────────────────────────

  function zoomToModel() {
    if (viewerRef.value && modelPosition) {
      const cartographic = Cartographic.fromCartesian(modelPosition);
      viewerRef.value.camera.flyTo({
        destination: Cartesian3.fromDegrees(
          CesiumMath.toDegrees(cartographic.longitude),
          CesiumMath.toDegrees(cartographic.latitude),
          cartographic.height + 120
        ),
        duration: 1.2
      });
    }
  }

  function exportScreenshot() {
    base.exportScreenshot(`building-${loadState.sourceKey || 'view'}-${Date.now()}.png`);
  }

  function flyToBuilding() {
    const viewer = viewerRef.value;
    if (!viewer) return;

    const transform = getBaseTransform(currentSource?.transform);
    activeTool = 'focus-building';
    viewer.camera.flyTo({
      destination: Cartesian3.fromDegrees(transform.longitude, transform.latitude - 0.00027, 3),
      orientation: {
        heading: CesiumMath.toRadians(0),
        pitch: CesiumMath.toRadians(-6),
        roll: 0
      },
      duration: 1.2
    });
    emitStatus(Cartesian3.fromDegrees(transform.longitude, transform.latitude, transform.height));
  }

  function resetView() {
    activeTool = 'browse';

    if (modelPosition && viewerRef.value) {
      const cartographic = Cartographic.fromCartesian(modelPosition);
      viewerRef.value.camera.flyTo({
        destination: Cartesian3.fromDegrees(
          CesiumMath.toDegrees(cartographic.longitude),
          CesiumMath.toDegrees(cartographic.latitude) - 0.00036,
          3
        ),
        orientation: {
          heading: CesiumMath.toRadians(0),
          pitch: CesiumMath.toRadians(-8),
          roll: 0
        },
        duration: 1.2
      });
    } else {
      flyToBuilding();
    }

    emitStatus();
  }

  function focusRoom(roomId: string) {
    const viewer = viewerRef.value;
    const coordinate = roomCoordinateMap.get(roomId);

    if (!viewer || !coordinate) return;

    activeTool = 'pick-room';
    viewer.camera.flyTo({
      destination: Cartesian3.fromDegrees(
        coordinate.longitude,
        coordinate.latitude,
        Math.max(coordinate.height + 90, 120)
      ),
      duration: 1
    });
    emitStatus(Cartesian3.fromDegrees(coordinate.longitude, coordinate.latitude, coordinate.height));
  }

  function focusFloor(floorId: string) {
    const roomId = currentFloors.find(item => item.id === floorId)?.roomIds[0];
    if (roomId) focusRoom(roomId);
  }

  // ─── 点位数据 ─────────────────────────────────────

  function addRoamPoints(points: Array<{ id: string; title: string; longitude: number; latitude: number }>) {
    const viewer = viewerRef.value;
    if (!viewer) return;

    points.forEach(point => {
      const id = `building-roam-${point.id}`;
      viewer.entities.add({
        id,
        show: layerVisibility['route-points'],
        position: Cartesian3.fromDegrees(point.longitude, point.latitude, 30),
        point: {
          pixelSize: 12,
          color: Color.fromCssColorString('#2b6bff')
        }
      });

      roamPointEntities.value.push(id);
      pointCoordinateMap.set(point.id, { longitude: point.longitude, latitude: point.latitude, height: 30 });
    });

    base.requestRender();
  }

  function clearRoamPoints() {
    const viewer = viewerRef.value;
    if (!viewer) return;

    roamPointEntities.value.forEach(id => { viewer.entities.removeById(id); });
    roamPointEntities.value = [];
    pointCoordinateMap.clear();
    base.requestRender();
  }

  function showRooms(rooms: BuildingRoom[], floors: BuildingFloor[], _points: BuildingRoamPoint[]) {
    const viewer = viewerRef.value;
    if (!viewer) return;

    currentFloors = floors;
    clearMarkers();

    const floorLookup = new Map(floors.map(item => [item.id, item]));

    rooms.forEach((room, index) => {
      floorLookup.get(room.floorId);
      const coordinate = getRoomCoordinate(room, index);
      const id = `building-room-${room.id}`;
      const entity = viewer.entities.add({
        id,
        show: layerVisibility.rooms,
        position: Cartesian3.fromDegrees(coordinate.longitude, coordinate.latitude, coordinate.height),
        point: {
          pixelSize: 11,
          color: Color.fromCssColorString(getRiskColor(room.riskLevel))
        }
      });

      entity.description = undefined;
      roomMarkerEntities.value.push(id);
      roomCoordinateMap.set(room.id, coordinate);
    });

    base.requestRender();
  }

  // ─── 公开接口 ─────────────────────────────────────

  function setActiveTool(tool: BuildingInteractiveTool) {
    activeTool = tool;
    emitStatus();
  }

  function setLayerVisible(layerKey: BuildingStageLayerKey, visible: boolean) {
    const viewer = viewerRef.value;
    layerVisibility[layerKey] = visible;

    if (!viewer) return;

    if (layerKey === 'imagery') {
      base.imageryLayers.forEach(layer => { layer.show = visible; });
    }

    if (layerKey === 'model' && modelEntityRef.value) {
      modelEntityRef.value.show = visible;
    }

    if (layerKey === 'rooms') {
      roomMarkerEntities.value.forEach(id => {
        const entity = viewer.entities.getById(id);
        if (entity) entity.show = visible;
      });
    }

    if (layerKey === 'route-points') {
      roamPointEntities.value.forEach(id => {
        const entity = viewer.entities.getById(id);
        if (entity) entity.show = visible;
      });
    }

    base.requestRender();
  }

  return {
    containerRef,
    loadState,
    initViewer,
    loadModel,
    unloadModel,
    zoomToModel,
    exportScreenshot,
    flyToBuilding,
    resetView,
    zoomIn: base.zoomIn,
    zoomOut: base.zoomOut,
    rotate: base.rotate,
    pitch: base.pitch,
    setActiveTool,
    setLayerVisible,
    focusFloor,
    focusRoom,
    showRooms,
    addRoamPoints,
    clearRoamPoints,
    status,
    is2dMode: base.is2dMode,
    toggleViewMode: base.toggleViewMode,
    // 给极少数外部调用 base 能力
    flyToLocation: base.flyToLocation
  };
}
