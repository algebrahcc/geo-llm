/**
 * 浏览器默认依赖装配（RFC-0001 · 第 2 步）
 *
 * 单独成文件的原因：这一份会把 `ports/cesium-kit-adapter.ts`（唯一 import `cesium` 的适配器）
 * 装进来，而 `create-scene.ts` 与它的测试都不该被 Cesium 依赖污染。
 * 所以「核心要哪些依赖」与「生产环境怎么提供这些依赖」分开表达。
 */
import {
  createEnvConfigPort,
  createExporterPort,
  createNotifyPort,
  createServiceSource,
  createTimersPort,
  createVectorSource
} from '../ports/adapters';
import { createCesiumKit } from '../ports/cesium-kit-adapter';
import type { SceneDeps } from '../ports/types';

/** 生产（浏览器）依赖集合：测试时逐项替换为替身即可 */
export function createBrowserSceneDeps(): SceneDeps {
  return {
    kit: createCesiumKit(),
    notify: createNotifyPort(),
    config: createEnvConfigPort(),
    timers: createTimersPort(),
    services: createServiceSource(),
    vector: createVectorSource(),
    exporter: createExporterPort()
  };
}
