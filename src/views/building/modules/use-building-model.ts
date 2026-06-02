import { onBeforeUnmount, reactive, shallowRef } from 'vue';
import {
  Cartesian3,
  Cartographic,
  Color,
  EllipsoidTerrainProvider,
  Entity,
  ImageryLayer,
  Math as CesiumMath,
  Rectangle,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  UrlTemplateImageryProvider,
  Viewer
} from 'cesium';
import { getGlobalImageryUrl, getRegionImageryUrl, getLocalImageryConfig, isOnlineImagery, getOnlineImageryProviderOptions } from '@/utils/imagery';
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
  const containerRef = shallowRef<HTMLDivElement | null>(null);
  const viewerRef = shallowRef<Viewer | null>(null);
  const modelEntityRef = shallowRef<Entity | null>(null);
  const globalImageryUrl = getGlobalImageryUrl();
  const regionImageryUrl = getRegionImageryUrl();
  const localConfig = getLocalImageryConfig();
  const imageryLayers = shallowRef<ImageryLayer[]>([]);
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
  let eventHandler: ScreenSpaceEventHandler | null = null;
  let cameraChangedListener: (() => void) | null = null;
  let currentSource: BuildingModelSource | null = null;
  let currentFloors: BuildingFloor[] = [];
  let currentRooms: BuildingRoom[] = [];
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

  function requestRender() {
    viewerRef.value?.scene.requestRender();
  }

  function getRoomCoordinate(room: BuildingRoom, roomIndex: number) {
    const floorIndex = Math.max(
      currentFloors.findIndex(item => item.id === room.floorId),
      0
    );
    const base = getBaseTransform(currentSource?.transform);

    return {
      longitude: base.longitude - 0.00045 + floorIndex * 0.00008 + roomIndex * 0.00015,
      latitude: base.latitude - 0.0003 + floorIndex * 0.00012 + roomIndex * 0.00005,
      height: base.height + 14 + floorIndex * 16 + roomIndex * 4
    };
  }

  function getPointCoordinate(point: { roomId?: string }, pointIndex: number) {
    const room = point.roomId ? currentRooms.find(item => item.id === point.roomId) : undefined;

    if (room) {
      const roomCoordinate = roomCoordinateMap.get(room.id);
      if (roomCoordinate) {
        return {
          longitude: roomCoordinate.longitude + 0.00003,
          latitude: roomCoordinate.latitude + 0.00003,
          height: roomCoordinate.height + 8
        };
      }
    }

    const base = getBaseTransform(currentSource?.transform);
    return {
      longitude: base.longitude + pointIndex * 0.00012,
      latitude: base.latitude - 0.0002 + pointIndex * 0.00006,
      height: base.height + 20 + pointIndex * 6
    };
  }

  async function initViewer() {
    if (!containerRef.value || viewerRef.value) return;

    const viewer = new Viewer(containerRef.value, {
      animation: false,
      baseLayerPicker: false,
      fullscreenButton: false,
      geocoder: false,
      homeButton: false,
      infoBox: false,
      navigationHelpButton: false,
      sceneModePicker: false,
      selectionIndicator: false,
      timeline: false,
      baseLayer: false,
      terrainProvider: new EllipsoidTerrainProvider(),
      requestRenderMode: true,
      maximumRenderTimeChange: Infinity
    });

    viewerRef.value = viewer;
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

    imageryLayers.value.push(
      viewer.imageryLayers.addImageryProvider(
        new UrlTemplateImageryProvider(
          isOnlineImagery()
            ? getOnlineImageryProviderOptions()
            : { url: globalImageryUrl, minimumLevel: 0, maximumLevel: localConfig.globalMaxLevel }
        )
      )
    );

    if (regionImageryUrl) {
      imageryLayers.value.push(
        viewer.imageryLayers.addImageryProvider(
          new UrlTemplateImageryProvider({
            url: regionImageryUrl,
            minimumLevel: 0,
            maximumLevel: localConfig.regionMaxLevel,
            rectangle: Rectangle.fromDegrees(...localConfig.regionRectangle)
          })
        )
      );
    }

    eventHandler = new ScreenSpaceEventHandler(viewer.scene.canvas);
    eventHandler.setInputAction((movement: { endPosition: Cartesian2 }) => {
      emitStatus(viewer.camera.pickEllipsoid(movement.endPosition, viewer.scene.globe.ellipsoid));
    }, ScreenSpaceEventType.MOUSE_MOVE);

    eventHandler.setInputAction((click: { position: Cartesian2 }) => {
      const picked = viewer.scene.pick(click.position);
      const roomId = picked?.id?.properties?.roomId?.getValue?.();

      if (typeof roomId === 'string') {
        activeTool = 'pick-room';
        options.onRoomPicked?.(roomId);
        emitStatus(viewer.camera.pickEllipsoid(click.position, viewer.scene.globe.ellipsoid));
      }
    }, ScreenSpaceEventType.LEFT_CLICK);

    cameraChangedListener = () => emitStatus();
    viewer.camera.changed.addEventListener(cameraChangedListener);
    emitStatus();
  }

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
    requestRender();
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
      const { longitude, latitude, height, scale } = source.transform;
      const position = Cartesian3.fromDegrees(longitude, latitude, height);

      const entity = viewer.entities.add({
        id: `building-model-${source.key}`,
        name: source.label,
        position,
        model: {
          uri: modelUrl,
          minimumPixelSize: 128,
          maximumScale: scale ? scale : 1
        }
      } as any);

      modelEntityRef.value = entity as Entity;
      entity.show = layerVisibility.model;
      loadState.loaded = true;
      modelPosition = position;
      requestRender();

      // 第一人称地面视角：站在建筑南侧约40m，眼高3m，向北仰望
      viewer.camera.flyTo({
        destination: Cartesian3.fromDegrees(longitude, latitude - 0.00036, 3),
        orientation: {
          heading: CesiumMath.toRadians(0),
          pitch: CesiumMath.toRadians(-8),
          roll: 0
        },
        duration: 1.5
      });
    } catch (error) {
      loadState.error = error instanceof Error ? error.message : 'GLB 模型加载失败';
    } finally {
      loadState.loading = false;
      emitStatus();
      requestRender();
    }
  }

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

  function captureView() {
    const viewer = viewerRef.value;
    if (!viewer) return '';
    return viewer.canvas.toDataURL('image/png');
  }

  function flyToBuilding() {
    const viewer = viewerRef.value;
    if (!viewer) return;

    const transform = getBaseTransform(currentSource?.transform);
    activeTool = 'focus-building';
    // 地面视角：站在南侧30m，眼高3m
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

  function zoomIn() {
    viewerRef.value?.camera.zoomIn(120);
    emitStatus();
  }

  function zoomOut() {
    viewerRef.value?.camera.zoomOut(120);
    emitStatus();
  }

  function rotate() {
    viewerRef.value?.camera.rotateLeft(CesiumMath.toRadians(12));
    emitStatus();
  }

  function pitch() {
    viewerRef.value?.camera.lookUp(CesiumMath.toRadians(8));
    emitStatus();
  }

  function setActiveTool(tool: BuildingInteractiveTool) {
    activeTool = tool;
    emitStatus();
  }

  function setLayerVisible(layerKey: BuildingStageLayerKey, visible: boolean) {
    const viewer = viewerRef.value;
    layerVisibility[layerKey] = visible;

    if (!viewer) return;

    if (layerKey === 'imagery') {
      imageryLayers.value.forEach(layer => { layer.show = visible; });
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

    requestRender();
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

  // 添加街景点位标注
  function addRoamPoints(points: Array<{ id: string; title: string; longitude: number; latitude: number }>) {
    const viewer = viewerRef.value;
    if (!viewer) return;

    points.forEach((point, index) => {
      const id = `building-roam-${point.id}`;
      const entity = viewer.entities.add({
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

    requestRender();
  }

  // 移除街景点位
  function clearRoamPoints() {
    const viewer = viewerRef.value;
    if (!viewer) return;

    roamPointEntities.value.forEach(id => { viewer.entities.removeById(id); });
    roamPointEntities.value = [];
    pointCoordinateMap.clear();
    requestRender();
  }

  function showRooms(rooms: BuildingRoom[], floors: BuildingFloor[], points: BuildingRoamPoint[]) {
    const viewer = viewerRef.value;
    if (!viewer) return;

    currentRooms = rooms;
    currentFloors = floors;
    clearMarkers();

    const floorLookup = new Map(floors.map(item => [item.id, item]));

    rooms.forEach((room, index) => {
      const floor = floorLookup.get(room.floorId);
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

      entity.properties = { roomId: room.id } as never;
      roomMarkerEntities.value.push(id);
      roomCoordinateMap.set(room.id, coordinate);
    });

    requestRender();
  }

  onBeforeUnmount(() => {
    if (cameraChangedListener && viewerRef.value) {
      viewerRef.value.camera.changed.removeEventListener(cameraChangedListener);
    }
    eventHandler?.destroy();
    if (viewerRef.value && !viewerRef.value.isDestroyed()) {
      viewerRef.value.destroy();
    }
  });

  return {
    containerRef,
    loadState,
    initViewer,
    loadModel,
    unloadModel,
    zoomToModel,
    captureView,
    flyToBuilding,
    resetView,
    zoomIn,
    zoomOut,
    rotate,
    pitch,
    setActiveTool,
    setLayerVisible,
    focusFloor,
    focusRoom,
    showRooms,
    addRoamPoints,
    clearRoamPoints,
    status
  };
}
