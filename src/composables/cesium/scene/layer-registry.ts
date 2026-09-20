/**
 * 图层显隐登记表（RFC-0001 · 第 3 步）
 *
 * 为什么需要它（两个已定位的真实缺陷，都有明确的代码路径）：
 *
 *  1. **底图开关会误伤数据服务影像**：`use-cesium-river.ts` / `use-cesium-planning.ts`
 *     的"底图"开关遍历 `base.imageryLayers` 把每一层的 `show` 都设成同一个值，
 *     而该数组里既有 config.json 兜底图层，也有 `applyServices` 推入的服务影像图层
 *     → 关底图会把服务影像一起关掉，并覆盖服务面板的眼睛状态。
 *  2. **隐藏过的服务层会在重建后自己亮回来**：`applyServices` 复用 provider 重建 layer
 *     （`removeAll` 后旧 layer 失效），新建的 `ImageryLayer` 默认 `show = true`，
 *     而句柄上的 `visible` 没有被回放 → 用户关掉的层又出现。
 *
 * 两者的根因相同：**`show` 没有归属**。此处的模型是「登记表持有真相，Cesium 图层只是投影」：
 * 每个 key 保存 `{ visible, opacity }`，`attach()` 绑定真实图层时**立即回放当前真相**。
 * 于是"重建图层后忘记恢复显隐"这类 bug 在结构上不可能发生，而不是靠调用方记得补一行。
 */
/** 一个图层的显隐真相（注意与 `@/typings/cesium` 中按模块分组的 LayerVisibility 不是一回事） */
export interface LayerVisibility {
  visible: boolean;
  opacity: number;
}

/** 可被显隐控制的图层投影（Cesium ImageryLayer / 3DTileset 等都能适配出这个形状） */
export interface LayerTarget {
  setVisible(visible: boolean): void;
  setOpacity(opacity: number): void;
}

export interface LayerRegistry {
  /** 登记 key（已存在则不覆盖其真相，避免重建路径把用户状态重置） */
  register(key: string, initial?: Partial<LayerVisibility>): void;
  has(key: string): boolean;
  /**
   * 绑定/替换该 key 的真实图层，并**立即回放当前真相**（这是本模块的核心价值）。
   *
   * @param targets 单个图层、图层数组或 null（null 表示解绑，仅清空投影、保留真相）
   */
  attach(key: string, targets: LayerTarget | LayerTarget[] | null): void;
  /** 设置显隐（key 未登记则隐式登记，默认可见） */
  setVisible(key: string, visible: boolean): void;
  /** 设置透明度（key 未登记则隐式登记） */
  setOpacity(key: string, opacity: number): void;
  /** 读取真相（未登记的 key 返回默认值，且不会登记） */
  get(key: string): LayerVisibility;
  /** 移除 key：真相与投影一并清掉 */
  remove(key: string): void;
  keys(): string[];
}

const DEFAULT_VISIBILITY: LayerVisibility = { visible: true, opacity: 1 };

interface Entry {
  visibility: LayerVisibility;
  targets: LayerTarget[];
}

export function createLayerRegistry(): LayerRegistry {
  const entries = new Map<string, Entry>();

  /** 把真相推给该 key 当前绑定的所有图层 */
  function project(entry: Entry) {
    for (const target of entry.targets) {
      target.setVisible(entry.visibility.visible);
      target.setOpacity(entry.visibility.opacity);
    }
  }

  /** 取条目；`create` 为 true 时隐式登记（写操作允许先于登记） */
  function entryOf(key: string, create: boolean): Entry | null {
    const existing = entries.get(key);
    if (existing) return existing;
    if (!create) return null;

    const created: Entry = { visibility: { ...DEFAULT_VISIBILITY }, targets: [] };
    entries.set(key, created);
    return created;
  }

  return {
    register(key, initial) {
      if (entries.has(key)) return;
      const entry: Entry = { visibility: { ...DEFAULT_VISIBILITY, ...initial }, targets: [] };
      entries.set(key, entry);
      project(entry);
    },

    has: key => entries.has(key),

    attach(key, targets) {
      const entry = entryOf(key, true) as Entry;
      entry.targets = targets === null ? [] : Array.isArray(targets) ? [...targets] : [targets];
      // 关键：新图层立刻对齐真相，而不是沿用 Cesium 的默认 show=true
      project(entry);
    },

    setVisible(key, visible) {
      const entry = entryOf(key, true) as Entry;
      entry.visibility.visible = visible;
      project(entry);
    },

    setOpacity(key, opacity) {
      const entry = entryOf(key, true) as Entry;
      entry.visibility.opacity = opacity;
      project(entry);
    },

    get(key) {
      const entry = entries.get(key);
      return entry ? { ...entry.visibility } : { ...DEFAULT_VISIBILITY };
    },

    remove(key) {
      entries.delete(key);
    },

    keys: () => [...entries.keys()]
  };
}
