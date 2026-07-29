import { computed, type Ref } from 'vue';
import type { RouteLocationNormalizedLoaded, Router } from 'vue-router';
import type { AgentDefinition, AgentKey } from './types';

export interface AgentSelection {
  agentKey: ReturnType<typeof computed<AgentKey>>;
  selectedAgent: ReturnType<typeof computed<AgentDefinition>>;
  updateAgentQuery: (key: AgentKey) => void;
}

/**
 * 智能体选择：仅基于真实智能体列表。
 * - 若 query.agent 命中真实智能体，直接采用
 * - 否则回退到列表第一个（列表加载完成后生效）
 */
export function useAgentSelection(
  route: RouteLocationNormalizedLoaded,
  router: Router,
  resolve: (key: string) => AgentDefinition,
  /** 当前真实智能体列表（ref），用于校验 query.agent 合法性 */
  agentList: Ref<AgentDefinition[]>
) {
  const agentKey = computed<AgentKey>(() => {
    const key = typeof route.query.agent === 'string' ? route.query.agent : '';
    return agentList.value.some(item => item.key === key) ? key : (agentList.value[0]?.key ?? '');
  });

  const selectedAgent = computed(() => resolve(agentKey.value));

  function updateAgentQuery(key: AgentKey) {
    router.replace({ query: { ...route.query, agent: key } });
  }

  return { agentKey, selectedAgent, updateAgentQuery };
}
