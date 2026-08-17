import { computed, onMounted, ref } from 'vue';
import type { AgentDefinition } from './types';
import { fetchDifyAppDelete, fetchDifyAppBaseUrl, fetchDifyAppList } from '@/service/api/difyApp';
import { mapDifyAppToAgent } from './real';

/**
 * 智能体列表：仅展示后端真实 Dify 应用，不再合并 mock。
 * 若后端请求失败，列表为空并标记 failed。
 */
export function useDifyApps() {
  const realApps = ref<AgentDefinition[]>([]);
  const loading = ref(false);
  const failed = ref(false);
  /** 全局 Dify 根地址（dify.url），应用未单独配置 baseUrl 时回退使用 */
  const globalBaseUrl = ref('');

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

  /** 加载全局 Dify 根地址（供拼接控制台编排页 URL 使用） */
  async function loadGlobalBaseUrl() {
    if (globalBaseUrl.value) return;
    try {
      const res = await fetchDifyAppBaseUrl();
      globalBaseUrl.value = res?.data?.baseUrl || '';
    } catch {
      globalBaseUrl.value = '';
    }
  }

  /**
   * 构建 Dify 控制台编排页 URL（方案 A：新标签跳转 Dify 原生编排）
   * 优先应用单独配置的 baseUrl，否则回退全局 dify.url。
   * 工作流应用（appType=3）的编排页是 /app/{id}/workflow 画布，
   * 其余类型（聊天助手/智能体）是 /apps/{id}/configuration。
   * @returns 编排页完整 URL；若缺少 difyAppId 或根地址则返回空字符串
   */
  function buildConsoleUrl(agent: AgentDefinition): string {
    const difyAppId = agent.difyAppId?.trim();
    if (!difyAppId) return '';
    const base = (agent.baseUrl || globalBaseUrl.value).trim().replace(/\/+$/, '');
    if (!base) return '';
    if (agent.appType === 3) {
      return `${base}/app/${difyAppId}/workflow`;
    }
    return `${base}/apps/${difyAppId}/configuration`;
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

  async function deleteAgent(appId: string | number) {
    const { error } = await fetchDifyAppDelete([appId]);
    if (error) {
      window.$message?.error('删除智能体失败，请稍后重试');
      return false;
    }
    window.$message?.success('已删除智能体');
    await loadRealApps();
    return true;
  }

  onMounted(() => {
    loadRealApps();
    loadGlobalBaseUrl();
  });

  return {
    agentList,
    realApps,
    loading,
    failed,
    globalBaseUrl,
    loadRealApps,
    loadGlobalBaseUrl,
    buildConsoleUrl,
    resolveAgent,
    deleteAgent
  };
}
