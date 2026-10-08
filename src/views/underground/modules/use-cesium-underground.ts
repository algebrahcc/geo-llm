/**
 * 地下空间场景的 Cesium 业务逻辑。
 *
 * 与 river/planning 的差异只有一处核心：**模型是主角，不是叠加在底图上的要素**。
 * 因此这里自己管三件事——
 *   1) 只加载 `threed` 分类的数据服务（本项目的地下模型都在 `public/data` 下，走 internal 相对路径）；
 *   2) 一次加载全部模型、切换用显隐（避免每次切换都重建 tileset 与重新走网络/解析流程）；
 *   3) 把选中模型的包围球、摆放点交给剖切控制器与相机预设。
 */
import { computed, reactive, ref } from 'vue';
import { Cartesian3, HeadingPitchRange, Matrix4, Math as CesiumMath, Transforms } from 'cesium';
import { useCesiumBase } from '@/composables/cesium/use-cesium-base';
import { useCesiumServices } from '@/composables/cesium/use-cesium-services';
import { fetchEnabledDataServices } from '@/service/api/dataservice';
import { unwrapResponseData } from '@/service/request/envelope';
import type { ServiceLayerHandle, ServiceLayerState } from '@/composables/cesium/service-loader';
import {
  DEFAULT_CLIPPING_STATE,
  createClippingController,
  resolveElevationRange,
  type ClippingState
} from '@/composables/cesium/underground/clipping';
import {
  clipAxisLabel,
  elevationToFloorLabel,
  formatElevation,
  sliderToElevation,
  type ClipAxis,
  type ElevationRange
} from '@/composables/cesium/underground/elevation-scale';

/** 面板中的模型条目 */
export interface UndergroundModelItem {
  id: number;
  name: string;
  /** 数据服务类型：3dtiles / glb / gltf */
  type: string;
  /** 原始 url（相对路径或 http 地址），用于诊断展示 */
  url: string;
  state: ServiceLayerState;
  error?: string;
  visible: boolean;
  /** 数据服务的「启用」标记：为 0 时仅登记条目，点眼睛才懒加载 */
  enabled: boolean;
}

/** 相机预设视角 */
export type ViewPreset = 'top' | 'front' | 'side' | 'oblique';

/**
 * 相机预设的朝向。
 *
 * pitch 一律为负值（俯视）：-90° 是正上方，其余是接近水平的斜视，
 * 便于看清地下模型的立面与楼板关系。
 */
function presetOrientation(preset: ViewPreset): { heading: number; pitch: number } {
  switch (preset) {
    case 'top':
      return { heading: CesiumMath.toRadians(0), pitch: CesiumMath.toRadians(-90) };
    case 'front':
      return { heading: CesiumMath.toRadians(0), pitch: CesiumMath.toRadians(-6) };
    case 'side':
      return { heading: CesiumMath.toRadians(90), pitch: CesiumMath.toRadians(-6) };
    default:
      return { heading: CesiumMath.toRadians(45), pitch: CesiumMath.toRadians(-32) };
  }
}

/**
 * 由中心点、距离与朝向算出相机世界坐标。
 *
 * `Camera.flyTo` 的 destination 只接受 Rectangle / Cartesian3（不接受 BoundingSphere），
 * 而 `HeadingPitchRange` 又必须配合 destination 使用，所以相机位置只能自己算：
 * 在中心点的 ENU 坐标系里按 heading/pitch 摆出偏移量，再变换回世界坐标。
 */
function cameraPositionFromOrientation(
  center: Cartesian3,
  distance: number,
  heading: number,
  pitch: number
): Cartesian3 {
  const horizontal = distance * Math.cos(pitch);
  const local = new Cartesian3(
    -horizontal * Math.sin(heading),
    -horizontal * Math.cos(heading),
    -distance * Math.sin(pitch)
  );
  const enu = Transforms.eastNorthUpToFixedFrame(center);
  return Matrix4.multiplyByPoint(enu, local, new Cartesian3());
}

export function useCesiumUnderground() {
  const base = useCesiumBase();
  // threed 服务必须经 useCesiumServices 登记：applyServices 只处理 imagery 与 terrain，
  // 直接把 threed 列表交给它会得到空句柄（面板表现为「没有可展示的模型」）
  const services = useCesiumServices(base);
  const handles = services.handles;
  const models = ref<UndergroundModelItem[]>([]);
  const activeId = ref<number | null>(null);
  const loading = ref(false);
  /** 最近一次拉取的服务清单，供面板状态刷新时查 url / enabled */
  const serviceList = ref<Api.DataService.DataServiceItem[]>([]);

  /** 剖切交互状态（reactive：面板 v-model 直接绑定） */
  const clipping = reactive<ClippingState>({ ...DEFAULT_CLIPPING_STATE });

  let controller: ReturnType<typeof createClippingController> | null = null;
  let boundHandle: ServiceLayerHandle | null = null;

  const activeHandle = computed(() => handles.value.find(h => h.id === activeId.value) ?? null);

  /** 选中模型的三维元信息（剖切与相机都要用） */
  const activeModel = computed(() => activeHandle.value?.threed ?? null);

  /** 当前模型标高范围：优先真实配置，其次包围球近似 */
  const elevationRange = computed<ElevationRange | null>(() => {
    const model = activeModel.value;
    if (!model) return null;
    const anchor = model.anchor ?? { lon: 0, lat: 0, height: 0 };
    return resolveElevationRange({ anchor, radius: model.radius, range: model.elevation });
  });

  /** 当前滑杆对应的标高与楼层标签 */
  const currentElevation = computed(() => {
    const range = elevationRange.value;
    return range ? sliderToElevation(clipping.slider, range) : 0;
  });

  const currentFloorLabel = computed(() => elevationToFloorLabel(currentElevation.value));

  /** 已就绪的模型数量（面板副标题） */
  const readyCount = computed(() => handles.value.filter(h => h.state === 'ready').length);

  /** 从句柄列表同步出面板条目（句柄是加载结果的唯一来源） */
  function syncItems(): void {
    const urlById = new Map(serviceList.value.map(item => [item.id, item.url]));
    const enabledById = new Map(serviceList.value.map(item => [item.id, Number(item.enabled) === 1]));
    models.value = handles.value.map(handle => ({
      id: handle.id,
      name: handle.name,
      type: handle.type,
      url: urlById.get(handle.id) ?? '',
      state: handle.state,
      error: handle.error,
      visible: handle.visible,
      enabled: enabledById.get(handle.id) ?? true
    }));
  }

  /** 拉取数据服务并登记 threed 图层（只登记 threed，其余分类交给底图兜底） */
  async function loadModels(): Promise<void> {
    loading.value = true;
    try {
      const list = unwrapResponseData<Api.DataService.DataServiceItem[]>(await fetchEnabledDataServices()) ?? [];
      serviceList.value = list;
      // enabled=0 的服务只登记不加载（useCesiumServices 的懒加载约定），
      // 用户在面板点眼睛时才真正发起加载
      await services.loadEnabled('threed', list);
      // 影像/地形仍需全量列表：applyServices 内部只处理这两类，用 handles 复用已加载的实例
      await base.applyServices(list, handles.value);
      syncItems();
      // 默认选中第一个条目，避免面板与地图都空着
      const first = handles.value.find(h => h.state === 'ready' && h.visible) ?? handles.value[0];
      if (first) selectModel(first.id);
    } finally {
      loading.value = false;
    }
  }

  /** 切换当前操作的模型（不改变显隐） */
  function selectModel(id: number): void {
    activeId.value = id;
  }

  /**
   * 显隐某个模型。
   *
   * 走 useCesiumServices 而不是直接 handle.show/hide：未启用的服务只登记了占位句柄，
   * 直接 show 只会点亮眼睛而不会真正加载模型；toggleService 才会触发懒加载。
   */
  function toggleVisible(id: number): void {
    const handle = handles.value.find(h => h.id === id);
    if (!handle) return;
    services.toggleService(id, !handle.visible);
    syncItems();
  }

  /** 重新加载失败/未加载的模型 */
  function retryModel(id: number): void {
    services.retryService(id);
    // 懒加载是异步的，等句柄状态落定再刷新面板
    window.setTimeout(syncItems, 200);
  }

  /** 把当前剖切状态应用到 Cesium */
  /**
   * 把当前剖切状态应用到 Cesium。
   *
   * 面板通过 `clip-change` 回传完整状态（控件不直接改写这里的对象），
   * 因此先落回唯一事实来源 `clipping`，再交给剖切控制器——保持一个数据源，
   * 避免面板副本与组合式函数各自演进而对不上。
   */
  function applyClipping(next?: ClippingState): void {
    if (next) {
      Object.assign(clipping, next);
    }
    const model = activeModel.value;
    const viewer = base.viewerRef.value;
    if (!model || !viewer) return;
    // 没有摆放点就无法把剖切面对到地理坐标上（模型此时位于 WGS84 原点，也不在视野内）
    if (!model.anchor) return;

    // 换模型时重建控制器：控制器持有上一个模型的 primitive 引用
    if (boundHandle !== activeHandle.value) {
      controller?.dispose();
      controller = createClippingController(viewer, {
        primitive: model.primitive,
        anchor: model.anchor,
        radius: model.radius,
        range: resolveElevationRange({ anchor: model.anchor, radius: model.radius, range: model.elevation })
      });
      boundHandle = activeHandle.value;
    }
    controller?.apply({ ...clipping });
  }

  /** 切换剖切轴 */
  function setClipAxis(axis: ClipAxis): void {
    clipping.axis = axis;
    applyClipping();
  }

  /** 定位到当前模型 */
  function flyToModel(): void {
    if (!activeModel.value) return;
    activeHandle.value?.flyTo?.();
  }

  /** 相机预设：俯视看平面、正视/侧视看立面、斜视看整体 */
  function flyPreset(preset: ViewPreset): void {
    const viewer = base.viewerRef.value;
    const model = activeModel.value;
    if (!viewer || !model) return;
    const anchor = model.anchor;
    const range = elevationRange.value;
    if (!anchor || !range) return;

    const centerHeight = (range.min + range.max) / 2;
    // 竖直预设贴近一些看立面，俯视需要更大距离才能看到整个平面
    const distance = Math.max(model.radius * (preset === 'top' ? 1.6 : 1.15), 40);
    const { heading, pitch } = presetOrientation(preset);
    const center = Cartesian3.fromDegrees(anchor.lon, anchor.lat, centerHeight);

    viewer.camera.flyTo({
      destination: cameraPositionFromOrientation(center, distance, heading, pitch),
      orientation: new HeadingPitchRange(heading, pitch, 0),
      duration: 0.8
    });
  }

  /** 设置选中模型的透明度（Model 支持 alpha；3D Tiles 由后续能力处理） */
  function setOpacity(opacity: number): void {
    activeHandle.value?.setOpacity(opacity);
  }

  return {
    // viewer
    containerRef: base.containerRef,
    viewerRef: base.viewerRef,
    cursorCoordinates: base.cursorCoordinates,
    initViewer: base.initViewer,
    setGlobeSurfaceTranslucent: base.setGlobeSurfaceTranslucent,
    requestRender: base.requestRender,
    // 数据
    models,
    handles,
    activeId,
    activeHandle,
    activeModel,
    loading,
    readyCount,
    loadModels,
    selectModel,
    toggleVisible,
    retryModel,
    // 剖切
    clipping,
    elevationRange,
    currentElevation,
    currentFloorLabel,
    applyClipping,
    setClipAxis,
    // 相机
    flyToModel,
    flyPreset,
    setOpacity,
    // 文案
    clipAxisLabel,
    formatElevation
  };
}
