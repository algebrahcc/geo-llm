/**
 * 目标检测结果的可视化配色（分析弹窗 / 情报详情卡共用，保证同名类别颜色一致）
 */

/** 类别配色板（按类别名稳定哈希取色） */
export const CLASS_COLORS = ['#29a3ff', '#7ee787', '#ffb02e', '#ff6d8f', '#b18aff', '#4dd6c8', '#ff8a5c', '#8db8ff'];

/** 按类别名取稳定颜色（同一类别在任意视图颜色相同） */
export function classColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return CLASS_COLORS[h % CLASS_COLORS.length];
}

/** 置信度分级：高（绿）/ 中（蓝）/ 低（橙，待人工确认） */
export function confLevel(conf: number): 'high' | 'mid' | 'low' {
  return conf >= 0.8 ? 'high' : conf >= 0.4 ? 'mid' : 'low';
}
