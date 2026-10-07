/**
 * 街景点击分发器（每个 Viewer 单例）
 *
 * 为什么需要它：如果每个街景服务各自挂一个 `ScreenSpaceEventHandler`，台北与新北
 * 两条服务同时启用时，同一次点击会被两个处理器各响应一遍 —— 谁先跑完谁打开全景，
 * 于是「点 A 城的点，弹出 B 城的全景」这种串台就会发生，且与点得准不准无关。
 *
 * 改成「一个 Viewer 一个分发器」后语义明确：点击时收集所有服务的命中结果，
 * 取**距离最近**的一个打开；都没命中就什么也不做（不影响其它图层的点击）。
 *
 * 生命周期：最后一个街景服务注销时销毁处理器 —— 句柄的 `remove()` 会调用返回的注销函数。
 */
import { Cartesian2, ScreenSpaceEventHandler, ScreenSpaceEventType, type Viewer } from 'cesium';

export interface StreetViewPickResult {
  /** 命中点在该服务点集中的下标 */
  index: number;
  /** 命中点与点击处地表点的距离（米）：多服务同时命中时取最小者 */
  distance: number;
}

export interface StreetViewPickTarget {
  /** 服务句柄 ID（注销用） */
  id: number;
  /** 判定本次点击是否命中本服务的街景点 */
  hitTest(position: Cartesian2): StreetViewPickResult | null;
  /** 打开命中的街景点 */
  open(index: number): void;
}

interface PickerEntry {
  handler: ScreenSpaceEventHandler;
  targets: Map<number, StreetViewPickTarget>;
}

/** 每个 Viewer 一份登记表（WeakMap：Viewer 销毁后自动回收） */
const pickers = new WeakMap<Viewer, PickerEntry>();

function dispatch(viewer: Viewer, position: Cartesian2): void {
  const entry = pickers.get(viewer);
  if (!entry || entry.targets.size === 0) return;

  let winner: { target: StreetViewPickTarget; index: number } | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  entry.targets.forEach(target => {
    const hit = target.hitTest(position);
    if (hit && hit.distance < bestDistance) {
      bestDistance = hit.distance;
      winner = { target, index: hit.index };
    }
  });

  if (winner) {
    const resolved = winner as { target: StreetViewPickTarget; index: number };
    resolved.target.open(resolved.index);
  }
}

/**
 * 登记一个街景服务到该 Viewer 的分发器。
 *
 * @returns 注销函数（在句柄 remove() 中调用）
 */
export function registerStreetViewPicker(viewer: Viewer, target: StreetViewPickTarget): () => void {
  let entry = pickers.get(viewer);
  if (!entry) {
    const targets = new Map<number, StreetViewPickTarget>();
    const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction((movement: ScreenSpaceEventHandler.PositionedEvent) => {
      dispatch(viewer, movement.position);
    }, ScreenSpaceEventType.LEFT_CLICK);
    entry = { handler, targets };
    pickers.set(viewer, entry);
  }

  const registered = entry;
  registered.targets.set(target.id, target);

  return () => {
    const current = pickers.get(viewer);
    if (!current) return;
    current.targets.delete(target.id);
    if (current.targets.size === 0) {
      current.handler.destroy();
      pickers.delete(viewer);
    }
  };
}
