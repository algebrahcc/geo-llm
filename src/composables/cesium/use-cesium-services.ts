/**
 * Cesium 数据服务组合层（设计文档 5.4）
 *
 * 聚合服务加载状态，对标 TerriaJS Workbench：维护激活图层句柄列表，
 * 提供批量加载 / 移除 / 显隐 / 透明度 / 影像互斥切换能力，供图层面板渲染。
 */
import { onBeforeUnmount, reactive, ref, type Ref } from 'vue';
import { loadService, type ServiceLayerHandle } from './service-loader';
import type { CesiumBaseReturn } from './use-cesium-base';
import { fetchEnabledDataServices } from '@/service/api/dataservice';
import { unwrapResponseData } from '@/service/request/envelope';

/**
 * 单个服务加载超时（ms）。
 *
 * 服务地址不可达时，Cesium 的 provider 请求（terrain layer.json / 3DTiles tileset.json）
 * 可能长期挂起而不 reject。若等 await 完成再登记句柄，该条目在图层面板里就会「消失」。
 * 这里用超时兜底把句柄标记为 error，保证列表始终可见且不阻塞后续图层应用。
 */
const LOAD_TIMEOUT_MS = 8000;

/**
 * loading 占位句柄：先登记进 handles，加载完成后由 loadService 原地填充。
 *
 * visible 初始跟随 enabled：enabled=1 默认显示（眼睛亮），enabled=0 默认隐藏
 * （眼睛关，但条目仍保留在面板中，用户可手动点开启用），对齐矢量图层的交互。
 * show/hide 自带 visible 维护，保证工厂失败时（句柄仍是占位实现）点击眼睛也有反馈。
 */
function createPlaceholder(s: Api.DataService.DataServiceItem): ServiceLayerHandle {
  // 显式标注 ServiceLayerHandle：否则 reactive 泛型推断会把 visible: true 收成
  // 字面量类型 true，导致 hide() 里 this.visible = false 报类型不匹配。
  const placeholder: ServiceLayerHandle = {
    id: s.id,
    category: s.category,
    type: s.type,
    name: s.name,
    state: 'loading',
    // 初始显隐跟随「启用」状态：enabled=1 默认显示（眼睛亮），
    // enabled=0 默认隐藏（眼睛关，但条目仍保留在面板中，用户可手动点开启用）。
    visible: Number(s.enabled) === 1,
    show() {
      this.visible = true;
    },
    hide() {
      this.visible = false;
    },
    remove() {},
    setOpacity() {}
  };
  return reactive(placeholder) as ServiceLayerHandle;
}

export interface UseCesiumServicesReturn {
  /** 激活服务图层句柄（响应式，供图层面板渲染） */
  handles: Ref<ServiceLayerHandle[]>;
  /** 批量加载启用中的服务（可指定分类；默认全部分类；presetList 复用已拉取的列表避免重复请求） */
  loadEnabled: (
    category?: Api.DataService.Category,
    presetList?: Api.DataService.DataServiceItem[]
  ) => Promise<ServiceLayerHandle[]>;
  /** 加载单个服务（已加载则复用；existing 为懒加载场景下已登记的占位句柄） */
  loadOne: (s: Api.DataService.DataServiceItem, existing?: ServiceLayerHandle) => Promise<ServiceLayerHandle | null>;
  /** 移除服务图层（不删 data_service 配置） */
  removeService: (id: number) => void;
  /** 显隐切换 */
  toggleService: (id: number, visible: boolean) => void;
  /** 透明度（0~1） */
  setOpacity: (id: number, opacity: number) => void;
  /** 影像类互斥切换：显示目标影像，隐藏其余影像 */
  switchImagery: (id: number) => void;
  /** 拖动排序：调整句柄顺序并同步 Cesium imageryLayers 层序 */
  reorder: (fromIndex: number, toIndex: number) => void;
  /** 清空所有激活图层 */
  clear: () => void;
}

export function useCesiumServices(base: CesiumBaseReturn): UseCesiumServicesReturn {
  const handles: Ref<ServiceLayerHandle[]> = ref<ServiceLayerHandle[]>([]);
  const loadedIds = new Set<number>();
  /** 已登记占位、但尚未真正加载的服务（懒加载：点眼睛时才 loadService） */
  const pendingLoads = new Map<number, Api.DataService.DataServiceItem>();

  async function loadOne(
    s: Api.DataService.DataServiceItem,
    existing?: ServiceLayerHandle
  ): Promise<ServiceLayerHandle | null> {
    const viewer = base.viewerRef.value;
    if (!viewer) return null;
    if (loadedIds.has(s.id)) {
      return handles.value.find(h => h.id === s.id) ?? null;
    }
    loadedIds.add(s.id);

    // 先登记 loading 占位：服务不可达时 await 可能长期挂起，
    // 等到完成再登记会让该条目在图层面板中迟迟不出现。
    // existing：懒加载场景复用的既有占位句柄（registerIdle 已登记进面板）。
    const placeholder = existing ?? createPlaceholder(s);
    if (!existing) {
      // 不可变更新：push 只触发数组内部 dep，不触发 ref 的 setter，
      // 父组件 computed 无法感知新增，这里整体重赋值以驱动响应式。
      handles.value = [...handles.value, placeholder];
    }

    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<ServiceLayerHandle>(resolve => {
      timer = setTimeout(() => {
        if (placeholder.state === 'loading') {
          placeholder.state = 'error';
          placeholder.error = `加载超时（${LOAD_TIMEOUT_MS / 1000}s 未响应，请检查服务地址）`;
        }
        resolve(placeholder);
      }, LOAD_TIMEOUT_MS);
    });

    // loadService 直接在 placeholder 上原地更新字段（ready / error）
    const handle = await Promise.race([loadService(s, viewer, placeholder), timeout]);
    if (timer) clearTimeout(timer);
    return handle;
  }

  async function loadEnabled(
    category?: Api.DataService.Category,
    presetList?: Api.DataService.DataServiceItem[]
  ): Promise<ServiceLayerHandle[]> {
    const services =
      presetList ?? unwrapResponseData<Api.DataService.DataServiceItem[]>(await fetchEnabledDataServices()) ?? [];
    // 全部服务都登记进面板（含不启用的），按 sort 排序；
    // enabled=0 的服务初始眼睛关闭，可在面板中手动启用（对齐矢量图层交互）。
    const list = services.filter(s => !category || s.category === category).sort((a, b) => a.sort - b.sort);
    // 并行登记：任一服务挂起不应阻塞其余服务登记（loadOne 内有超时兜底）。
    // 启用中的服务实际加载；不启用的仅登记占位（眼睛关、懒加载，点眼睛时才真正加载），
    // 对齐「矢量图层」的懒加载交互。loadOne/registerIdle 均在首个 await 前同步登记占位，
    // 故 handles 顺序仍与 list 一致。
    await Promise.allSettled(list.map(s => (Number(s.enabled) === 1 ? loadOne(s) : registerIdle(s))));
    return handles.value;
  }

  /** 不启用的服务：仅登记条目（眼睛关、state 就绪），不实际加载，点眼睛时才 loadService */
  function registerIdle(s: Api.DataService.DataServiceItem): ServiceLayerHandle {
    const placeholder = createPlaceholder(s);
    placeholder.state = 'ready';
    handles.value = [...handles.value, placeholder];
    pendingLoads.set(s.id, s);
    return placeholder;
  }

  function removeService(id: number): void {
    const index = handles.value.findIndex(h => h.id === id);
    if (index >= 0) {
      handles.value[index].remove();
      handles.value = handles.value.filter(h => h.id !== id);
      loadedIds.delete(id);
      pendingLoads.delete(id);
    }
  }

  function toggleService(id: number, visible: boolean): void {
    const handle = handles.value.find(h => h.id === id);
    if (!handle) return;
    if (visible) {
      const pending = pendingLoads.get(id);
      if (pending) {
        // 首次启用：先记住用户意图（visible=true），再触发真实加载；
        // loadService 完成后 keepVisible=true → show()，失败则眼睛回退为关闭。
        pendingLoads.delete(id);
        handle.state = 'loading';
        handle.visible = true;
        void loadOne(pending, handle);
        return;
      }
      handle.show();
    } else {
      handle.hide();
    }
  }

  function setOpacity(id: number, opacity: number): void {
    handles.value.find(h => h.id === id)?.setOpacity(opacity);
  }

  function switchImagery(id: number): void {
    handles.value.forEach(h => {
      if (h.category === 'imagery') {
        if (h.id === id) h.show();
        else h.hide();
      }
    });
  }

  function reorder(fromIndex: number, toIndex: number): void {
    const list = [...handles.value];
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return;
    if (fromIndex >= list.length || toIndex >= list.length) return;
    const [moved] = list.splice(fromIndex, 1);
    list.splice(toIndex, 0, moved);
    handles.value = list;

    // 同步 Cesium imageryLayers 层序（仅 imagery 类持有 layer；0=底部，末尾=最顶层）
    const viewer = base.viewerRef.value;
    if (!viewer) return;
    const imageryHandles = list.filter(h => h.category === 'imagery' && h.layer);
    if (imageryHandles.length > 1) {
      for (const h of imageryHandles) {
        viewer.imageryLayers.lowerToBottom(h.layer!);
      }
    }
  }

  function clear(): void {
    handles.value.forEach(h => h.remove());
    handles.value = [];
    loadedIds.clear();
    pendingLoads.clear();
  }

  onBeforeUnmount(clear);

  return {
    handles,
    loadEnabled,
    loadOne,
    removeService,
    toggleService,
    setOpacity,
    switchImagery,
    reorder,
    clear
  };
}
