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
    if (!key) return agentList.value[0]?.key ?? '';
    // 列表加载完成且命中则直接用；列表异步加载尚未完成或暂时未匹配到时，
    // 仍优先保留 URL 上用户明确指定的 agent，避免竞态导致发送时 currentAppId 为空而报“请先选择智能体”。
    if (agentList.value.length && agentList.value.some(item => item.key === key)) return key;
    return key;
  });

  const selectedAgent = computed(() => resolve(agentKey.value));

  function updateAgentQuery(key: AgentKey) {
    router.replace({ query: { ...route.query, agent: key } });
  }

  return { agentKey, selectedAgent, updateAgentQuery };
}
