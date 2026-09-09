/**
 * 分析流程编排器（纯逻辑，不依赖 UI）
 *
 * 把「步骤序列推进 + 状态维护 + 耗时统计 + 取消」收敛到一处，
 * 业务方只需描述每一步"做什么"，不必再各自维护下标、状态枚举与 setTimeout。
 *
 * 深模块：对外只有一个入口 runAnalysis()，内部隐藏状态机、快照与计时细节。
 * 时间源与等待实现均可注入，因此测试无需真实等待即可验证完整流程。
 */

export type StepStatus = 'pending' | 'running' | 'success' | 'failed';

export interface StepState {
  /** 稳定标识 —— 取代原先按下标访问（如 steps[1]）的脆弱写法 */
  key: string;
  label: string;
  status: StepStatus;
  description?: string;
  duration?: string;
}

export interface StepRunContext {
  /** 更新当前步骤的实时描述，可多次调用 */
  note: (text: string) => void;
  /** 等待；实现由编排器注入，测试里可立即返回 */
  wait: (ms: number) => Promise<void>;
}

export interface StepDefinition {
  key: string;
  label: string;
  /** 该步骤的实际工作；抛错即视为本步失败 */
  run: (ctx: StepRunContext) => Promise<void> | void;
}

export interface RunAnalysisOptions {
  steps: StepDefinition[];
  /** 每次状态变化时回调，参数为不可变快照（避免调用方直接改内部状态） */
  onChange: (steps: StepState[]) => void;
  /** 取消信号：已中断则在下一步开始前抛出 AnalysisAbortedError */
  signal?: AbortSignal;
  /** 等待实现，默认 setTimeout（测试注入） */
  sleep?: (ms: number) => Promise<void>;
  /** 时间源，默认 Date.now（测试注入） */
  now?: () => number;
}

/** 主动取消时抛出，便于调用方区分「用户中断」与「执行失败」 */
export class AnalysisAbortedError extends Error {
  constructor() {
    super('analysis aborted');
    this.name = 'AnalysisAbortedError';
  }
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

/**
 * 顺序执行步骤序列，逐步推进状态并在每次变化后回调。
 * @returns 最终步骤状态快照
 */
export async function runAnalysis(options: RunAnalysisOptions): Promise<StepState[]> {
  const { steps, onChange, signal } = options;
  const sleep = options.sleep ?? defaultSleep;
  const now = options.now ?? Date.now;

  const states: StepState[] = steps.map(s => ({ key: s.key, label: s.label, status: 'pending' }));
  const emit = () => onChange(states.map(s => ({ ...s })));

  emit();

  for (const def of steps) {
    if (signal?.aborted) throw new AnalysisAbortedError();

    const state = states.find(s => s.key === def.key);
    if (!state) continue;

    state.status = 'running';
    emit();

    const startedAt = now();
    try {
      await def.run({
        note: text => {
          state.description = text;
          emit();
        },
        wait: ms => sleep(ms)
      });
      state.status = 'success';
    } catch (error) {
      state.status = 'failed';
      state.duration = `${((now() - startedAt) / 1000).toFixed(1)}s`;
      emit();
      throw error;
    }

    state.duration = `${((now() - startedAt) / 1000).toFixed(1)}s`;
    emit();
  }

  return states.map(s => ({ ...s }));
}
