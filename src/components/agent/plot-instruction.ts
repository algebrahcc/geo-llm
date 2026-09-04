/**
 * 场景智能体标绘指令协议与解析
 *
 * Dify Agent 按《场景智能体面板设计方案》的契约，在回复文本中输出标绘指令
 * （```plot 代码块，或未按契约包裹的裸 JSON 对象），本模块负责提取、容错解析
 * 与合法性校验，输出结构化的 PlotInstruction 供宿主页面分发到 Cesium 标绘。
 *
 * scanPlotInstructions 可在流式过程中反复调用：JSON 未完整时 parse 失败会被
 * 跳过，待后续 delta 补全后自然解析成功——标绘不依赖 SSE 流结束。
 */

export type PlotAction = 'addMark' | 'addLine' | 'addPolygon' | 'addText' | 'remove' | 'clear' | 'flyTo';

export interface PlotInstruction {
  action: PlotAction;
  /** 标绘实体 id（解析时由组件分配，宿主页用它注册/删除实体） */
  id?: string;
  /** 名称（点的 label、线/面的 title） */
  name?: string;
  color?: string;
  lon?: number;
  lat?: number;
  height?: number;
  /** addText 的文字内容 */
  text?: string;
  /** addLine/addPolygon 的坐标串 [[lon, lat], ...] */
  positions?: Array<[number, number]>;
}

/** action 元信息（指令卡片渲染用） */
export const PLOT_ACTION_META: Record<PlotAction, { label: string; icon: string }> = {
  addMark: { label: '标注点', icon: 'mdi:map-marker' },
  addText: { label: '文字标注', icon: 'mdi:label-outline' },
  addLine: { label: '画线', icon: 'mdi:vector-polyline' },
  addPolygon: { label: '圈定区域', icon: 'mdi:vector-polygon' },
  remove: { label: '删除标绘', icon: 'mdi:marker-cancel' },
  clear: { label: '清空标绘', icon: 'mdi:eraser' },
  flyTo: { label: '视角定位', icon: 'mdi:crosshairs-gps' }
};

export interface PlotScanResult {
  /** 解析成功的指令（raw 为指令原文，供跨 delta 去重；id 为占位空串，调用方可覆盖） */
  valid: Array<{ instruction: PlotInstruction; raw: string }>;
  /** ```plot 代码块解析失败的数量（裸 JSON 不完整属流式中间态，不计入） */
  failedBlocks: number;
}

/** ```plot\n{...}\n``` 代码块（允许语言标注带空格、有无换行皆可） */
const PLOT_BLOCK_RE = /```plot\s*\r?\n?([\s\S]*?)```/g;

/** 裸 JSON 对象：AI 可能未用 ```plot 包裹，直接输出 {"action":"...",...}（单层花括号，positions 为方括号数组） */
const BARE_JSON_RE = /\{[^{}]*"action"\s*:\s*"(?:addMark|addLine|addPolygon|addText|remove|clear|flyTo)"[^{}]*\}/g;

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function isValidLng(v: unknown): v is number {
  return isFiniteNumber(v) && v >= -180 && v <= 180;
}

function isValidLat(v: unknown): v is number {
  return isFiniteNumber(v) && v >= -90 && v <= 90;
}

function isValidPosition(v: unknown): v is [number, number] {
  return Array.isArray(v) && v.length >= 2 && isValidLng(v[0]) && isValidLat(v[1]);
}

function normalizeInstruction(obj: Record<string, unknown>, id: string): PlotInstruction | null {
  const action = obj.action as PlotAction;
  if (!action || !(action in PLOT_ACTION_META)) return null;

  const instruction: PlotInstruction = {
    action,
    id,
    name: typeof obj.name === 'string' && obj.name.trim() ? obj.name.trim() : undefined,
    color: typeof obj.color === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(obj.color) ? obj.color : undefined
  };

  switch (action) {
    case 'addMark':
    case 'addText':
    case 'flyTo': {
      if (!isValidLng(obj.lon) || !isValidLat(obj.lat)) return null;
      instruction.lon = obj.lon;
      instruction.lat = obj.lat;
      if (isFiniteNumber(obj.height) && obj.height > 0) instruction.height = obj.height;
      if (action === 'addText' && typeof obj.text === 'string' && obj.text.trim()) {
        instruction.text = obj.text.trim();
      }
      return instruction;
    }
    case 'addLine':
    case 'addPolygon': {
      const positions = Array.isArray(obj.positions) ? obj.positions.filter(isValidPosition) : [];
      const minLength = action === 'addLine' ? 2 : 3;
      if (positions.length < minLength) return null;
      instruction.positions = positions;
      return instruction;
    }
    case 'remove': {
      if (typeof obj.id === 'string' && obj.id.trim()) {
        instruction.id = obj.id.trim();
        return instruction;
      }
      return null;
    }
    case 'clear':
      return instruction;
    default:
      return null;
  }
}

/**
 * 扫描文本中的全部标绘指令（```plot 代码块 + 裸 JSON 对象）。
 */
export function scanPlotInstructions(text: string): PlotScanResult {
  const valid: Array<{ instruction: PlotInstruction; raw: string }> = [];
  let failedBlocks = 0;

  const consume = (body: string, isBlock: boolean) => {
    const trimmed = body.trim();
    if (!trimmed) return;
    try {
      const instruction = normalizeInstruction(JSON.parse(trimmed) as Record<string, unknown>, '');
      if (instruction) {
        valid.push({ instruction, raw: trimmed });
        return;
      }
    } catch {
      /* JSON 未完整或非法 */
    }
    if (isBlock) failedBlocks += 1;
  };

  PLOT_BLOCK_RE.lastIndex = 0;
  let blockMatch: RegExpExecArray | null;
  while ((blockMatch = PLOT_BLOCK_RE.exec(text)) !== null) {
    consume(blockMatch[1], true);
  }

  BARE_JSON_RE.lastIndex = 0;
  let bareMatch: RegExpExecArray | null;
  while ((bareMatch = BARE_JSON_RE.exec(text)) !== null) {
    consume(bareMatch[0], false);
  }

  return { valid, failedBlocks };
}

/**
 * 从文本中移除已解析的标绘指令（```plot 块与裸 JSON），返回清理后的展示文本。
 * 解析失败的 ```plot 块计入 failedBlocks；非指令 JSON 原样保留。
 */
export function stripPlotInstructions(text: string): { cleaned: string; failedBlocks: number } {
  let failedBlocks = 0;
  const cleaned = text
    .replace(PLOT_BLOCK_RE, (_match, body: string) => {
      const trimmed = body.trim();
      if (!trimmed) return '';
      try {
        const instruction = normalizeInstruction(JSON.parse(trimmed) as Record<string, unknown>, '');
        if (instruction) return '';
      } catch {
        /* ignore */
      }
      failedBlocks += 1;
      return '';
    })
    .replace(BARE_JSON_RE, match => {
      try {
        const instruction = normalizeInstruction(JSON.parse(match) as Record<string, unknown>, '');
        return instruction ? '' : match;
      } catch {
        return match;
      }
    })
    .trim();
  return { cleaned, failedBlocks };
}
