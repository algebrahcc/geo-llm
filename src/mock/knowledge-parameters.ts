import type { KnowledgeDocument, KnowledgeChunk } from './knowledge';

export interface EnvironmentParameter {
  key: string;
  label: string;
  value: number | null;
  unit: string;
  category: '水文' | '地形' | '情报' | '工程';
  confidence: number;
  source: 'text-extract' | 'image-extract';
  sourceDetail: string;
}

export interface ParameterSchemaItem {
  key: string;
  label: string;
  unit: string;
  category: EnvironmentParameter['category'];
  range: [number, number];
}

export const PARAMETER_SCHEMA: readonly ParameterSchemaItem[] = [
  // 水文
  { key: 'water_temp', label: '水温', unit: '°C', category: '水文', range: [2, 30] },
  { key: 'flow_velocity', label: '流速', unit: 'm/s', category: '水文', range: [0.3, 5.0] },
  { key: 'water_depth', label: '水深', unit: 'm', category: '水文', range: [1.2, 18] },
  { key: 'river_width', label: '河宽', unit: 'm', category: '水文', range: [80, 800] },
  { key: 'wave_height', label: '浪高', unit: 'm', category: '水文', range: [0.1, 2.5] },
  { key: 'tide_range', label: '潮差', unit: 'm', category: '水文', range: [0.5, 4.0] },
  // 地形
  { key: 'bank_slope', label: '岸滩坡度', unit: '°', category: '地形', range: [3, 25] },
  { key: 'bank_height', label: '岸高', unit: 'm', category: '地形', range: [1, 15] },
  { key: 'bank_type', label: '岸滩土质', unit: '级', category: '地形', range: [1, 5] },
  { key: 'riverbed_geology', label: '河床地质', unit: '级', category: '地形', range: [1, 5] },
  { key: 'bearing_capacity', label: '地基承载力', unit: 'kPa', category: '地形', range: [80, 400] },
  // 情报
  { key: 'enemy_threat', label: '敌情威胁等级', unit: '级', category: '情报', range: [1, 5] },
  { key: 'observation_risk', label: '观察暴露风险', unit: '级', category: '情报', range: [1, 5] },
  { key: 'air_defense', label: '防空条件', unit: '级', category: '情报', range: [1, 5] },
  { key: 'concealment', label: '隐蔽条件', unit: '级', category: '情报', range: [1, 5] },
  // 工程
  { key: 'pontoon_span', label: '浮桥最大跨度', unit: 'm', category: '工程', range: [60, 600] },
  { key: 'bridge_capacity', label: '舟桥通行能力', unit: '辆/h', category: '工程', range: [20, 200] },
  { key: 'ferry_candidates', label: '候选渡口数', unit: '个', category: '工程', range: [1, 8] },
] as const;

function rand(min: number, max: number): number {
  return +(min + Math.random() * (max - min)).toFixed(1);
}

function pickConfidence(): number {
  return +(0.58 + Math.random() * 0.38).toFixed(2);
}

/**
 * 从文档元数据模拟提取文本参数（10-15 项）
 */
export function extractTextParameters(doc: KnowledgeDocument): EnvironmentParameter[] {
  const tags = doc.tags.map(t => t.toLowerCase());
  const isRiver = tags.some(t => t.includes('渡河') || t.includes('水文') || t.includes('岸线'));
  const isIntel = tags.some(t => t.includes('敌情') || t.includes('威胁') || t.includes('情报'));

  const params: EnvironmentParameter[] = [];

  for (const schema of PARAMETER_SCHEMA) {
    // 水文类：渡河相关文档命中概率更高
    if (schema.category === '水文' && !isRiver && Math.random() > 0.35) continue;
    // 情报类：情报文档命中概率更高
    if (schema.category === '情报' && !isIntel && Math.random() > 0.4) continue;
    // 地形类：普遍存在
    if (schema.category === '地形' && Math.random() > 0.75) continue;
    // 工程类：渡河文档才有
    if (schema.category === '工程' && !isRiver && Math.random() > 0.2) continue;

    const [min, max] = schema.range;
    params.push({
      key: schema.key,
      label: schema.label,
      value: rand(min, max),
      unit: schema.unit,
      category: schema.category,
      confidence: pickConfidence(),
      source: 'text-extract',
      sourceDetail: `文档「${doc.name}」文本抽取`
    });
  }

  return params;
}

/**
 * 从图片区域 chunk 模拟提取图像参数（8-12 项，偏向水文/地形）
 */
export function extractImageParameters(
  doc: KnowledgeDocument,
  chunks: KnowledgeChunk[]
): EnvironmentParameter[] {
  const params: EnvironmentParameter[] = [];
  const schemaItems = PARAMETER_SCHEMA.filter(s => s.category === '水文' || s.category === '地形');

  // 随机选取 8-12 项
  const count = 8 + Math.floor(Math.random() * 5);
  const shuffled = [...schemaItems].sort(() => Math.random() - 0.5).slice(0, Math.min(count, schemaItems.length));

  // 用 chunk 的平均 confidence 作为基准
  const avgConf = chunks.length > 0
    ? chunks.reduce((sum, c) => sum + (c.confidence || 0.7), 0) / chunks.length
    : 0.72;

  for (const schema of shuffled) {
    const [min, max] = schema.range;
    const sensorConf = +(avgConf + (Math.random() - 0.3) * 0.15).toFixed(2);
    params.push({
      key: schema.key,
      label: schema.label,
      value: rand(min, max),
      unit: schema.unit,
      category: schema.category,
      confidence: Math.min(0.98, Math.max(0.45, sensorConf)),
      source: 'image-extract',
      sourceDetail: `图像「${doc.name}」多光谱分析`
    });
  }

  return params;
}

/**
 * 获取参数覆盖率
 */
export function calculateCoverage(params: EnvironmentParameter[]): { covered: number; total: number; rate: number } {
  const total = PARAMETER_SCHEMA.length;
  const covered = new Set(params.map(p => p.key)).size;
  return { covered, total, rate: Math.round((covered / total) * 100) };
}
