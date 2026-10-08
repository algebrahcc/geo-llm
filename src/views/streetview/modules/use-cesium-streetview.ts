/**
 * 城市街景场景：在三维球上按城市浏览街景
 *
 * 与「数据服务里配一条街景服务、去别的场景里点」的区别：这里把街景当成**一个场景**来用 ——
 * 左侧列出可用城市（台北 / 新北 / 本地示例），选定后球上立即呈现该城市的街景点与街景路线，
 * 配合上一处/下一处沿道路浏览。多条街景服务同时存在时，也在这里做互斥切换，
 * 不会出现两条服务同时撒点、点击串台的情况。
 */
import { computed, onBeforeUnmount, ref, shallowRef } from 'vue';
import type { Viewer } from 'cesium';
import { useCesiumBase } from '@/composables/cesium/use-cesium-base';
import { loadService, type ServiceLayerHandle } from '@/composables/cesium/service-loader';
import { fetchEnabledDataServices } from '@/service/api/dataservice';

/**
 * 内置的本地街景预设。
 *
 * 为什么需要兜底：本地数据（`public/data/streetview/<目录>`）本身不需要后端，
 * 但「城市街景」页原先只列出**数据服务里配置过**的街景记录 —— 演示机/离线环境没有后端时，
 * 页面就会是空的，明明数据就在 public 下却看不到。这里把已知的本地目录直接列出来，
 * 有后端配置时再按 url 去重，不重复出现。
 */
const LOCAL_PRESETS: Array<{ dir: string; name: string }> = [
  { dir: 'kaohsiung', name: '高雄街景' },
  { dir: 'taipei', name: '台北街景' },
  { dir: 'newtaipei', name: '新北街景' }
];

/** 把本地预设包装成数据服务条目的形状：id 用负数，避免与后端记录冲突 */
function presetToService(preset: { dir: string; name: string }, index: number): Api.DataService.DataServiceItem {
  return {
    id: -1 - index,
    name: preset.name,
    category: 'streetview',
    type: 'panorama',
    origin: 'internal',
    url: `data/streetview/${preset.dir}`,
    enabled: 1,
    sort: index + 1,
    status: 1,
    createTime: ''
  };
}

export interface StreetviewCity {
  id: number;
  name: string;
  service: Api.DataService.DataServiceItem;
  /** 街景点数量（加载完成后回填，加载前为 null） */
  pointCount: number | null;
  /** 数据来源标签：在线服务 / 本地数据 */
  sourceLabel: string;
}

export function useCesiumStreetview() {
  const { containerRef, viewerRef, cursorCoordinates, initViewer } = useCesiumBase();

  const cities = ref<StreetviewCity[]>([]);
  const activeCityId = ref<number | null>(null);
  const loading = ref(false);
  const errorText = ref('');
  const activeHandle = shallowRef<ServiceLayerHandle | null>(null);

  const activeCity = computed(() => cities.value.find(city => city.id === activeCityId.value) ?? null);
  const canBrowse = computed(() => Boolean(activeHandle.value?.streetviewController));

  /** 来源判定与 source-factory 保持一致：http(s) 或 external 走在线服务，其余是本地目录 */
  function sourceLabelOf(service: Api.DataService.DataServiceItem): string {
    return service.origin === 'external' || /^https?:\/\//i.test(service.url) ? '在线服务' : '本地数据';
  }

  async function initScene(): Promise<void> {
    await initViewer({
      prepareViewer(viewer: Viewer) {
        // 与渡河/规划一致：按需渲染，静止时不空转 GPU（帧率测试会话会临时关掉它）
        viewer.scene.requestRenderMode = true;
        viewer.scene.globe.showGroundAtmosphere = false;
      }
    });
    await loadCities();
  }

  async function loadCities(): Promise<void> {
    loading.value = true;
    try {
      const { data } = await fetchEnabledDataServices();
      const remoteList = (Array.isArray(data) ? data : []).filter(item => item.category === 'streetview');

      // 后端已配置的同 url 服务优先，避免同一个本地目录出现两遍
      const configuredUrls = new Set(remoteList.map(item => item.url));
      const presets = LOCAL_PRESETS.filter(preset => !configuredUrls.has(`data/streetview/${preset.dir}`)).map(
        presetToService
      );

      cities.value = [...remoteList, ...presets].map(item => ({
        id: item.id,
        name: item.name,
        service: item,
        pointCount: null,
        sourceLabel: sourceLabelOf(item)
      }));

      if (cities.value.length === 0) {
        errorText.value =
          '没有可用的街景数据：请在「数据中心 → 数据服务」新增街景服务，或把数据放到 public/data/streetview 下';
        return;
      }
      await selectCity(cities.value[0].id);
    } catch (e) {
      // 后端不可用不代表演示做不了：本地预设照常列出
      console.error('[streetview] 加载街景服务列表失败，改用本地预设：', e);
      cities.value = LOCAL_PRESETS.map(presetToService).map(item => ({
        id: item.id,
        name: item.name,
        service: item,
        pointCount: null,
        sourceLabel: sourceLabelOf(item)
      }));
      if (cities.value.length > 0) await selectCity(cities.value[0].id);
    } finally {
      loading.value = false;
    }
  }

  function disposeActive(): void {
    activeHandle.value?.remove();
    activeHandle.value = null;
  }

  async function selectCity(id: number): Promise<void> {
    const viewer = viewerRef.value;
    const city = cities.value.find(item => item.id === id);
    if (!viewer || !city || viewer.isDestroyed()) return;

    // 互斥：切城市时先卸掉上一个城市的点位与路线，避免两城点位叠在一起
    disposeActive();
    activeCityId.value = id;
    errorText.value = '';

    const handle = await loadService(city.service, viewer);
    activeHandle.value = handle;
    if (handle.state === 'error') {
      errorText.value = handle.error ?? `「${city.name}」加载失败`;
      return;
    }

    city.pointCount = handle.streetview?.points ?? null;
    viewer.scene.requestRender();
    handle.flyTo?.();
  }

  /** 开始浏览：打开漫游路线的第一个街景点（同时打开全景浮窗） */
  function startBrowse(): void {
    activeHandle.value?.streetviewController?.open();
  }

  /** 上一处 / 下一处：沿道路顺序步进 */
  function step(delta: 1 | -1): void {
    activeHandle.value?.streetviewController?.step(delta);
  }

  /** 定位到当前城市的街景覆盖范围 */
  function flyToActive(): void {
    activeHandle.value?.flyTo?.();
  }

  onBeforeUnmount(disposeActive);

  return {
    containerRef,
    viewerRef,
    cursorCoordinates,
    cities,
    activeCity,
    activeCityId,
    loading,
    errorText,
    canBrowse,
    initScene,
    selectCity,
    startBrowse,
    step,
    flyToActive
  };
}
