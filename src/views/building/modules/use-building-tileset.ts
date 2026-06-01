import { onBeforeUnmount, reactive, shallowRef } from 'vue';
import {
  Cartesian2,
  Cartesian3,
  Cartographic,
  Cesium3DTileset,
  Color,
  EllipsoidTerrainProvider,
  HeadingPitchRoll,
  HeightReference,
  ImageryLayer,
  LabelStyle,
  Math as CesiumMath,
  Matrix4,
  Rectangle,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  Transforms,
  UrlTemplateImageryProvider,
  Viewer
} from 'cesium';
import { getGlobalImageryUrl, getRegionImageryUrl, getLocalImageryConfig, isOnlineImagery, getOnlineImageryProviderOptions } from '@/utils/imagery';
import type {
  BuildingFloor,
  BuildingRoamPoint,
  BuildingRoom,
  BuildingTilesetLoadState,
  BuildingTilesetSource,
  BuildingTilesetTransform
} from './types';
import type { BuildingInteractiveTool, BuildingStageLayerKey, BuildingStageStatusInfo } from './types-stage';

interface UseBuildingTilesetOptions {
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

export function useBuildingTileset(options: UseBuildingTilesetOptions = {}) {
  const containerRef = shallowRef<HTMLDivElement | null>(null);
  const viewerRef = shallowRef<Viewer | null>(null);
  const tilesetRef = shallowRef<Cesium3DTileset | null>(null);
  const globalImageryUrl = getGlobalImageryUrl();
  const regionImageryUrl = getRegionImageryUrl();
  const localConfig = getLocalImageryConfig();
  const imageryLayers = shallowRef<ImageryLayer[]>([]);
  const roomMarkerEntities = shallowRef<string[]>([]);
  const routePointEntities = shallowRef<string[]>([]);
  const status = reactive<BuildingStageStatusInfo>({
    longitude: '--',
    latitude: '--',
    altitude: '--',
    cameraHeight: '--',
    activeTool: '浏览',
    sourceLabel: '--',
    loadStatus: '待命'
  });

  const loadState = reactive<BuildingTilesetLoadState>({
    sourceKey: '',
    sourceLabel: '',
    loading: false,
    loaded: false,
    error: ''
  });

  const layerVisibility: Record<BuildingStageLayerKey, boolean> = {
    imagery: true,
    tileset: true,
    rooms: true,
    'route-points': true
  };

  const roomCoordinateMap = new Map<string, { longitude: number; latitude: number; height: number }>();
  const pointCoordinateMap = new Map<string, { longitude: number; latitude: number; height: number }>();

  let activeTool: BuildingInteractiveTool = 'browse';
  let eventHandler: ScreenSpaceEventHandler | null = null;
  let cameraChangedListener: (() => void) | null = null;
  let currentSource: BuildingTilesetSource | null = null;
  let currentFloors: BuildingFloor[] = [];
  let currentRooms: BuildingRoom[] = [];

  const toolNameMap: Record<BuildingInteractiveTool, string> = {
    browse: '浏览',
    'focus-building': '定位楼宇',
    'pick-room': '房间点选'
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

  function getBaseTransform(transform?: BuildingTilesetTransform) {
    return {
      longitude: transform?.longitude ?? 121.5082,
      latitude: transform?.latitude ?? 25.0376,
      height: transform?.height ?? 12
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

  function getPointCoordinate(point: BuildingRoamPoint, pointIndex: number) {
    const room = currentRooms.find(item => item.id === point.roomId);

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

    roomMarkerEntities.value.forEach(id => {
      viewer.entities.removeById(id);
    });
    routePointEntities.value.forEach(id => {
      viewer.entities.removeById(id);
    });
    roomMarkerEntities.value = [];
    routePointEntities.value = [];
    roomCoordinateMap.clear();
    pointCoordinateMap.clear();
  }

  function unloadTileset() {
    const viewer = viewerRef.value;

    if (!viewer) return;

    clearMarkers();

    if (tilesetRef.value) {
      viewer.scene.primitives.remove(tilesetRef.value);
      tilesetRef.value = null;
    }

    loadState.loaded = false;
    requestRender();
  }

  function applyTransform(tileset: Cesium3DTileset, source: BuildingTilesetSource) {
    const { longitude, latitude, height, heading, pitch: pitchDegrees, roll, scale } = source.transform;
    const origin = Cartesian3.fromDegrees(longitude, latitude, height);
    const hpr = HeadingPitchRoll.fromDegrees(heading, pitchDegrees, roll);
    const modelMatrix = Transforms.headingPitchRollToFixedFrame(origin, hpr);

    if (scale !== 1) {
      const scaleMatrix = Matrix4.fromUniformScale(scale);
      tileset.modelMatrix = Matrix4.multiply(modelMatrix, scaleMatrix, new Matrix4());
    } else {
      tileset.modelMatrix = modelMatrix;
    }
  }

  async function loadTileset(source: BuildingTilesetSource) {
    const viewer = viewerRef.value;
    const tilesetUrl = normalizeUrl(source.tilesetUrl);

    if (!viewer) return;

    currentSource = source;
    loadState.sourceKey = source.key;
    loadState.sourceLabel = source.label;
    loadState.loading = true;
    loadState.loaded = false;
    loadState.error = '';
    emitStatus();

    unloadTileset();

    if (!tilesetUrl) {
      loadState.loading = false;
      loadState.error = source.sourceType === 'remote' ? '远程 3D Tiles 地址未配置。' : '本地 tileset.json 尚未放置。';
      emitStatus();
      return;
    }

    try {
      const tileset = await Cesium3DTileset.fromUrl(tilesetUrl, {
        maximumScreenSpaceError: source.maximumScreenSpaceError ?? 12
      });

      applyTransform(tileset, source);

      tileset.tileFailed.addEventListener(error => {
        loadState.error = error.message || '3D Tiles 切片加载失败';
      });

      viewer.scene.primitives.add(tileset);
      tilesetRef.value = tileset;
      tileset.show = layerVisibility.tileset;
      loadState.loaded = true;
      requestRender();
      void viewer.zoomTo(tileset);
    } catch (error) {
      loadState.error = error instanceof Error ? error.message : '3D Tiles 加载失败';
    } finally {
      loadState.loading = false;
      emitStatus();
      requestRender();
    }
  }

  function zoomToTileset() {
    if (viewerRef.value && tilesetRef.value) {
      void viewerRef.value.zoomTo(tilesetRef.value);
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
    viewer.camera.flyTo({
      destination: Cartesian3.fromDegrees(transform.longitude, transform.latitude, 83200),
      duration: 1.2
    });
    emitStatus(Cartesian3.fromDegrees(transform.longitude, transform.latitude, transform.height));
  }

  function resetView() {
    activeTool = 'browse';

    if (tilesetRef.value && viewerRef.value) {
      void viewerRef.value.zoomTo(tilesetRef.value);
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
      imageryLayers.value.forEach(layer => {
        layer.show = visible;
      });
    }

    if (layerKey === 'tileset' && tilesetRef.value) {
      tilesetRef.value.show = visible;
    }

    if (layerKey === 'rooms') {
      roomMarkerEntities.value.forEach(id => {
        const entity = viewer.entities.getById(id);

        if (entity) entity.show = visible;
      });
    }

    if (layerKey === 'route-points') {
      routePointEntities.value.forEach(id => {
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

    if (roomId) {
      focusRoom(roomId);
    }
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
          pixelSize: 10,
          color: Color.fromCssColorString(getRiskColor(room.riskLevel)),
          outlineColor: Color.WHITE,
          outlineWidth: 2,
          heightReference: HeightReference.NONE
        },
        label: {
          text: `${floor?.label ?? ''} ${room.name}`,
          font: '12px Microsoft YaHei',
          fillColor: Color.WHITE,
          showBackground: true,
          backgroundColor: Color.fromCssColorString('#0f172a').withAlpha(0.78),
          pixelOffset: new Cartesian2(0, -22),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          style: LabelStyle.FILL
        },
        description: room.summary
      });

      entity.properties = {
        roomId: room.id
      } as never;
      roomMarkerEntities.value.push(id);
      roomCoordinateMap.set(room.id, coordinate);
    });

    points.forEach((point, index) => {
      const coordinate = getPointCoordinate(point, index);
      const id = `building-point-${point.id}`;

      viewer.entities.add({
        id,
        show: layerVisibility['route-points'],
        position: Cartesian3.fromDegrees(coordinate.longitude, coordinate.latitude, coordinate.height),
        point: {
          pixelSize: 8,
          color: Color.fromCssColorString('#2b6bff'),
          outlineColor: Color.WHITE,
          outlineWidth: 2,
          heightReference: HeightReference.NONE
        },
        label: {
          text: point.title,
          font: '12px Microsoft YaHei',
          fillColor: Color.WHITE,
          showBackground: true,
          backgroundColor: Color.fromCssColorString('#0f172a').withAlpha(0.78),
          pixelOffset: new Cartesian2(0, -20),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          style: LabelStyle.FILL
        },
        description: point.description
      });

      routePointEntities.value.push(id);
      pointCoordinateMap.set(point.id, coordinate);
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
    loadTileset,
    unloadTileset,
    zoomToTileset,
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
    status
  };
}
