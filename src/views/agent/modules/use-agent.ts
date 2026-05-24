import { computed } from 'vue';
import type { RouteLocationNormalizedLoaded, Router } from 'vue-router';
import { getAgentByKey, type AgentKey } from '@/mock/agent';

function normalizeAgentKey(value: unknown): AgentKey {
  const key = typeof value === 'string' ? value : '';
  const agent = getAgentByKey(key);
  return agent.key;
}

export function useAgentSelection(route: RouteLocationNormalizedLoaded, router: Router) {
  const agentKey = computed<AgentKey>(() => normalizeAgentKey(route.query.agent));
  const selectedAgent = computed(() => getAgentByKey(agentKey.value));

  function updateAgentQuery(nextKey: AgentKey) {
    router.replace({
      query: {
        ...route.query,
        agent: nextKey
      }
    });
  }

  return {
    agentKey,
    selectedAgent,
    updateAgentQuery
  };
}
