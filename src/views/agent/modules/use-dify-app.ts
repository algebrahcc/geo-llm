import { computed, onMounted, ref } from 'vue';
import type { AgentDefinition } from './types';
import { fetchDifyAppDelete, fetchDifyAppList } from '@/service/api/difyApp';
import { mapDifyAppToAgent } from './real';

/**
 * 智能体列表：仅展示后端真实 Dify 应用，不再合并 mock。
 * 若后端请求失败，列表为空并标记 failed。
 */
export function useDifyApps() {
  const realApps = ref<AgentDefinition[]>([]);
  const loading = ref(false);
  const failed = ref(false);

  async function loadRealApps() {
    loading.value = true;
    failed.value = false;
    try {
      const res = await fetchDifyAppList();
      realApps.value = (res?.data || []).map(mapDifyAppToAgent);
    } catch {
      failed.value = true;
      realApps.value = [];
    } finally {
      loading.value = false;
    }
  }

  const agentList = computed<AgentDefinition[]>(() => realApps.value);

  const FALLBACK_AGENT: AgentDefinition = {
    key: '',
    name: '未选择智能体',
    slogan: '',
    description: '',
    category: '',
    status: 'draft',
    model: '',
    version: '',
    confidence: 0,
    avgDuration: '--',
    icon: 'mdi:robot',
    capabilityTags: [],
    tools: [],
    recommendedPrompts: [],
    defaultInput: ''
  };

  function resolveAgent(key: string): AgentDefinition {
    const fromReal = realApps.value.find(item => item.key === key);
    if (fromReal) return fromReal;
    if (realApps.value.length) return realApps.value[0];
    return FALLBACK_AGENT;
  }

  async function deleteAgent(appId: number) {
    const { error } = await fetchDifyAppDelete([appId]);
    if (error) {
      window.$message?.error('删除智能体失败，请稍后重试');
      return false;
    }
    window.$message?.success('已删除智能体');
    await loadRealApps();
    return true;
  }

  onMounted(loadRealApps);

  return { agentList, realApps, loading, failed, loadRealApps, resolveAgent, deleteAgent };
}
