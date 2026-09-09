import type { Ref } from 'vue';
import type { Entity, Viewer } from 'cesium';

/**
 * 智能体标绘层（纯逻辑，不依赖业务类型）
 *
 * AI 指令产生的点/线/面/文字覆盖物：按 id 管理，支持单删/全清、同 id 覆盖更新。
 * 实体外观（军事符号/圆点、虚线与实线等）由宿主模块通过工厂注入——
 * 本模块不创建任何具体 Entity，只负责「id 解析、去重、增删、全清」这一层编排。
 *
 * 背景：river 与 planning 的 use-cesium-* 中各有一份逐行相同的实现，
 * 差异仅在调用各自 createPoint/Line/PolygonEntity。这里把共同编排抽成一处。
 */

/** AI 覆盖物的通用外形字段（仅传递，不解释） */
interface AiOverlayShape {
  id?: string;
  name?: string;
  color?: string;
}

/** 点标注入参 */
export interface AiPlotMarkInput extends AiOverlayShape {
  lon: number;
  lat: number;
}

/** 文字标注入参 */
export interface AiPlotTextInput extends AiOverlayShape {
  lon: number;
  lat: number;
  text: string;
}

/** 线标注入参 */
export interface AiPlotLineInput extends AiOverlayShape {
  positions: Array<[number, number]>;
  width?: number;
}

/** 面标注入参 */
export interface AiPlotPolygonInput extends AiOverlayShape {
  positions: Array<[number, number]>;
}

/** 实体工厂：由宿主模块按各自样式创建实体并加入 viewer.entities，返回新实体（null=创建失败） */
export interface AiPlotEntityFactories {
  createPoint: (item: {
    id: string;
    name: string;
    longitude: number;
    latitude: number;
    color: string;
  }) => Entity | null;
  createLine: (item: {
    id: string;
    name: string;
    color: string;
    positions: Array<[number, number]>;
    width?: number;
  }) => Entity | null;
  createPolygon: (item: {
    id: string;
    name: string;
    color: string;
    positions: Array<[number, number]>;
  }) => Entity | null;
}

export interface UseCesiumAiPlotOptions extends AiPlotEntityFactories {
  viewerRef: Ref<Viewer | null>;
  requestRender: () => void;
}

export interface CesiumAiPlotReturn {
  drawAiMark: (item: AiPlotMarkInput) => string;
  drawAiText: (item: AiPlotTextInput) => string;
  drawAiLine: (item: AiPlotLineInput) => string;
  drawAiPolygon: (item: AiPlotPolygonInput) => string;
  removeAiOverlay: (id: string) => boolean;
  clearAiOverlays: () => void;
  /** 遍历当前所有 AI 覆盖物实体（供模块的图层显隐同步使用） */
  eachAiOverlay: (fn: (entity: Entity) => void) => void;
}

/**
 * 创建智能体标绘控制器。
 * 每次调用产生独立状态（Map + 自增序号），多实例互不干扰。
 */
export function useCesiumAiPlot(options: UseCesiumAiPlotOptions): CesiumAiPlotReturn {
  const { viewerRef, requestRender, createPoint, createLine, createPolygon } = options;

  const aiOverlayEntries = new Map<string, Entity>();
  let aiPlotSeq = 0;

  function resolveAiId(item: AiOverlayShape): string {
    return item.id || `ai-plot-${++aiPlotSeq}`;
  }

  function removeExisting(viewer: Viewer, id: string) {
    // 同 id 实体已存在时先移除，避免多轮对话 id 复用导致 add 冲突
    const existing = viewer.entities.getById(id);
    if (existing) viewer.entities.remove(existing);
  }

  function drawAiMark(item: AiPlotMarkInput): string {
    const id = resolveAiId(item);
    const viewer = viewerRef.value;
    if (!viewer) return id;
    removeExisting(viewer, id);
    const entity = createPoint({
      id,
      name: item.name || 'AI 标注',
      longitude: item.lon,
      latitude: item.lat,
      color: item.color || '#fb7185'
    });
    if (entity) {
      aiOverlayEntries.set(id, entity);
      requestRender();
    }
    return id;
  }

  function drawAiText(item: AiPlotTextInput): string {
    return drawAiMark({ ...item, name: item.text });
  }

  function drawAiLine(item: AiPlotLineInput): string {
    const id = resolveAiId(item);
    const viewer = viewerRef.value;
    if (!viewer) return id;
    removeExisting(viewer, id);
    const entity = createLine({
      id,
      name: item.name || 'AI 标绘线',
      color: item.color || '#f7b267',
      positions: item.positions,
      width: item.width ?? 4
    });
    if (entity) {
      aiOverlayEntries.set(id, entity);
      requestRender();
    }
    return id;
  }

  function drawAiPolygon(item: AiPlotPolygonInput): string {
    const id = resolveAiId(item);
    const viewer = viewerRef.value;
    if (!viewer) return id;
    removeExisting(viewer, id);
    const entity = createPolygon({
      id,
      name: item.name || 'AI 标绘区域',
      color: item.color || '#fb7185',
      positions: item.positions
    });
    if (entity) {
      aiOverlayEntries.set(id, entity);
      requestRender();
    }
    return id;
  }

  function removeAiOverlay(id: string): boolean {
    const entity = aiOverlayEntries.get(id);
    const viewer = viewerRef.value;
    if (!entity || !viewer) return false;
    viewer.entities.remove(entity);
    aiOverlayEntries.delete(id);
    requestRender();
    return true;
  }

  function clearAiOverlays(): void {
    const viewer = viewerRef.value;
    if (!viewer) return;
    aiOverlayEntries.forEach(e => viewer.entities.remove(e));
    aiOverlayEntries.clear();
    requestRender();
  }

  function eachAiOverlay(fn: (entity: Entity) => void): void {
    aiOverlayEntries.forEach(e => fn(e));
  }

  return {
    drawAiMark,
    drawAiText,
    drawAiLine,
    drawAiPolygon,
    removeAiOverlay,
    clearAiOverlays,
    eachAiOverlay
  };
}
