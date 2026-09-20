/**
 * Cesium 场景内核 —— 生产适配器（RFC-0001 · 第 1 步）
 *
 * 本文件只包装「非 Cesium」的副作用源：提示、运行时配置、定时器、后端数据。
 * 创建 Viewer 的适配器在 `./cesium-kit-adapter.ts`（那是唯一 import `cesium` 的地方），
 * 这样本文件的边界测试可以在 Node 里跑，不被 Cesium 的 DOM 依赖拖累。
 *
 * 第 1 步是**纯新增**：没有任何现有文件改为使用这些适配器，
 * 因此行为与现状完全一致；接入从第 2 步（核心编排）开始。
 */
import { fetchEnabledDataServices } from '@/service/api/dataservice';
import { fetchVectorExtent, getVectorTileUrl } from '@/service/api/vector';
import { unwrapResponseData } from '@/service/request/envelope';
import { getImageryConfig } from '@/utils/imagery';
import { getRealServiceBaseURL } from '@/utils/service';
import { getTerrainConfig } from '@/utils/terrain';
import type {
  ExporterPort,
  SceneEnvConfig,
  SceneNotifier,
  SceneServiceSource,
  SceneTimers,
  SceneVectorSource
} from './types';

/**
 * 数据服务加载超时（ms）—— 唯一来源。
 *
 * 现状：`use-cesium-base.ts:104`（SERVICE_LOAD_TIMEOUT_MS）与
 * `use-cesium-services.ts:20`（LOAD_TIMEOUT_MS）各写了一份 8000，
 * 靠注释口头约定"保持一致"。本常量是收敛点，第 2 步把两处改为引用它。
 */
export const SERVICE_LOAD_TIMEOUT_MS = 8000;

/** 提示适配器：转发到 Naive UI 的全局 `window.$message` */
export function createNotifyPort(): SceneNotifier {
  return {
    success: message => {
      window.$message?.success(message);
    },
    warning: message => {
      window.$message?.warning(message);
    },
    error: message => {
      window.$message?.error(message);
    },
    loading: message => {
      // duration=0：常驻直到调用方 dispose；$message 不可用（初始化早期）时返回空句柄
      const instance = window.$message?.loading(message, { duration: 0 });
      return {
        dispose: () => {
          instance?.destroy();
        }
      };
    }
  };
}

/** 配置适配器：`import.meta.env` / `window.__APP_CONFIG__` / 影像与地形配置 */
export function createEnvConfigPort(): SceneEnvConfig {
  return {
    publicBaseUrl: () => import.meta.env.BASE_URL,
    // 复用既有实现：运行时 config.json 优先，其次构建期变量，最后内置默认值
    serviceBaseUrl: getRealServiceBaseURL,
    imagery: getImageryConfig,
    terrain: getTerrainConfig,
    serviceTimeoutMs: SERVICE_LOAD_TIMEOUT_MS
  };
}

/**
 * 定时器适配器。
 *
 * 用 `globalThis` 而不是 `window`：定时器本身属于全局对象，浏览器里两者等价，
 * 而 `globalThis` 让本端口在 Node 下也能工作 —— 这正是"可注入"的前提。
 */
export function createTimersPort(): SceneTimers {
  return {
    setTimeout: (handler, ms) => globalThis.setTimeout(handler, ms),
    clearTimeout: id => globalThis.clearTimeout(id),
    now: () => Date.now()
  };
}

/**
 * 服务目录适配器。
 *
 * 注意：这里**完成信封解包**（现状由调用方各自 `unwrapResponseData` 处理），
 * 解包结果为空时兜底为 `[]`，让调用方拿到的永远是数组。
 * 该适配器在第 1 步尚未被接入，等第 2/4 步调用方迁移时同步去掉它们各自的解包。
 */
export function createServiceSource(): SceneServiceSource {
  return {
    listEnabled: async () =>
      unwrapResponseData<Api.DataService.DataServiceItem[]>(await fetchEnabledDataServices()) ?? []
  };
}

/**
 * 截图落盘适配器：把 dataURL 交给浏览器下载。
 *
 * DOM 操作（`document` / `a[download]`）刻意留在这一层，
 * 核心只拿到 `saveDataUrl(dataUrl, filename)`，因此不依赖 DOM。
 */
export function createExporterPort(): ExporterPort {
  return {
    saveDataUrl: (dataUrl, filename) => {
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };
}

/** 矢量数据适配器：范围查询解包为业务数据，瓦片模板 URL 直接透传 */
export function createVectorSource(): SceneVectorSource {
  return {
    extent: async vectorId => unwrapResponseData<number[]>(await fetchVectorExtent(vectorId)),
    tileUrl: (vectorId, sourceType) => getVectorTileUrl(vectorId, sourceType)
  };
}
