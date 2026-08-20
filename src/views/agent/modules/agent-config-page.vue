<script setup lang="ts">
import { computed, reactive, ref, watch, h, type ComputedRef } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { NButton, NTag, type DataTableColumns } from 'naive-ui';
import { useThemeStore } from '@/store/modules/theme';
import SvgIcon from '@/components/custom/svg-icon.vue';
import { fetchDifyAppUpdate, fetchDifyAppApiKeys, createDifyAppApiKey } from '@/service/api/difyApp';
import {
  fetchDifyModelConfig,
  updateDifyModelConfig,
  fetchDifyAdvancedModel,
  updateDifyAdvancedModel
} from '@/service/api/dify';
import AgentConfigForm from './agent-config-form.vue';
import AgentSidebar from './agent-sidebar.vue';
import { useAgentSelection } from './use-agent';
import { useDifyApps } from './use-dify-app';
import type { AgentConfigFormModel } from './agent-config-form.vue';
import AgentDatasetBinding from './agent-dataset-binding.vue';
import AgentPromptEditor from './agent-prompt-editor.vue';

defineOptions({
  name: 'AgentConfigPage'
});

const route = useRoute();
const router = useRouter();
const themeStore = useThemeStore();
const darkMode = computed(() => themeStore.darkMode);
const { resolveAgent, agentList, loading: agentLoading, loadRealApps, deleteAgent, buildConsoleUrl } = useDifyApps();
const { agentKey, selectedAgent, updateAgentQuery } = useAgentSelection(route, router, resolveAgent, agentList);
const saving = ref(false);

function handleOpenConsole() {
  const url = buildConsoleUrl(selectedAgent.value);
  if (!url) {
    window.$message?.warning('该应用未关联远端应用 ID，请先在编排控制台创建或同步该应用');
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

async function handleSubmit(config: AgentConfigFormModel) {
  try {
    saving.value = true;
    await fetchDifyAppUpdate(config.id, {
      name: config.name,
      type: config.type,
      description: config.description,
      sort: config.sort,
      status: config.status
    });
    await loadRealApps();
    window.$message?.success('应用配置已保存');
  } catch {
    window.$message?.error('保存配置失败，请稍后重试');
  } finally {
    saving.value = false;
  }
}

async function handleDelete() {
  const target = selectedAgent.value;
  const appId = target.key;
  if (!appId) return;
  window.$dialog?.warning({
    title: '删除智能体',
    content: `确定要删除「${target.name}」吗？删除后无法恢复。`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      const ok = await deleteAgent(appId);
      if (ok) {
        router.push({ name: 'agent_index' as never });
      }
    }
  });
}

function navigateToSubPage(name: 'agent_test' | 'agent_tools') {
  router.push({
    name: name as never,
    query: { ...route.query, agent: agentKey.value }
  });
}

function handleSelect(key: typeof agentKey.value) {
  updateAgentQuery(key);
}

// ===== 模型参数（Dify /model-config） =====
type CfgTabKey = 'base' | 'model' | 'strategy' | 'knowledge' | 'prompt' | 'api';
const activeTab = ref<CfgTabKey>('base');
const isAgent = computed(() => (selectedAgent.value?.appType ?? 0) === 2);
/** 是否工作流应用（编排为节点画布，无工作流级 model_config） */
const isWorkflow = computed(() => (selectedAgent.value?.appType ?? 0) === 3);

interface CfgTabItem {
  key: CfgTabKey;
  label: string;
  icon: string;
}

/** 各 Tab 在编排配置中的可见性（按应用类型裁剪，对齐不同应用类型的配置形态） */
const visibleTabs: ComputedRef<CfgTabItem[]> = computed(() => {
  const wf = isWorkflow.value;
  const agent = isAgent.value;
  const tabs: CfgTabItem[] = [
    { key: 'base', label: '基础信息', icon: 'mdi:form-textbox' },
    { key: 'model', label: '模型参数', icon: 'mdi:tune' },
    { key: 'strategy', label: 'Agent 策略', icon: 'mdi:brain' },
    { key: 'knowledge', label: '知识库', icon: 'mdi:database' },
    { key: 'prompt', label: '提示词编排', icon: 'mdi:card-text-outline' },
    { key: 'api', label: 'API 访问', icon: 'mdi:key-outline' }
  ];
  return tabs.filter(t => {
    if (t.key === 'model' || t.key === 'knowledge' || t.key === 'prompt') return !wf;
    if (t.key === 'strategy') return agent;
    return true;
  });
});

const typeLabel = computed(() => {
  if (isWorkflow.value) return '工作流';
  if (isAgent.value) return 'Agent';
  return '聊天助手';
});
const typeColor = computed(() => {
  if (isWorkflow.value) return '#34d399';
  if (isAgent.value) return '#8b5cf6';
  return '#38bdf8';
});
/** 当前智能体的本地 dify_app 主键 id（后端 Long 雪花序列化为字符串，必须保留字符串避免精度丢失） */
const currentAppId = computed(() => selectedAgent.value?.key || null);

const modelLoading = ref(false);
const modelSaving = ref(false);
const modelConfig = ref<Api.Dify.ModelConfig | null>(null);
const modelMeta = reactive({ provider: '', name: '' });
const modelForm = reactive({
  temperature: 0.7,
  topP: 1,
  maxTokens: 1000,
  presencePenalty: 0,
  frequencyPenalty: 0,
  /** 停止序列（数组），UI 上用逗号分隔字符串编辑 */
  stop: '',
  /** 响应格式：text / json_object */
  responseFormat: 'text'
});

async function loadModelConfig() {
  if (currentAppId.value == null) return;
  modelLoading.value = true;
  try {
    const res = await fetchDifyModelConfig(currentAppId.value);
    const cfg = (res?.data ?? null) as Api.Dify.ModelConfig | null;
    modelConfig.value = cfg;
    const m = (cfg?.model ?? {}) as Record<string, unknown>;
    modelMeta.provider = String(m.provider ?? '');
    modelMeta.name = String(m.name ?? '');
    const cp = (m.completion_params ?? {}) as Record<string, unknown>;
    modelForm.temperature = Number(cp.temperature ?? 0.7);
    modelForm.topP = Number(cp.top_p ?? 1);
    modelForm.maxTokens = Number(cp.max_tokens ?? 1000);
    modelForm.presencePenalty = Number(cp.presence_penalty ?? 0);
    modelForm.frequencyPenalty = Number(cp.frequency_penalty ?? 0);
    const stopArr = Array.isArray(cp.stop) ? (cp.stop as unknown[]).map(String) : [];
    modelForm.stop = stopArr.join(',');
    const respFormat = cp.response_format as Record<string, unknown> | string | undefined;
    const respType = respFormat && typeof respFormat === 'object' ? String(respFormat.type ?? '') : '';
    modelForm.responseFormat = respType || String(respFormat ?? '') || 'text';
  } catch {
    window.$message?.warning('加载模型配置失败（后端可能未代理 model-config）');
  } finally {
    modelLoading.value = false;
  }
}

async function saveModelConfig() {
  if (currentAppId.value == null) return;
  modelSaving.value = true;
  try {
    const base = (modelConfig.value?.model ?? {}) as Record<string, unknown>;
    const completionParams: Record<string, unknown> = {
      temperature: modelForm.temperature,
      top_p: modelForm.topP,
      max_tokens: modelForm.maxTokens,
      presence_penalty: modelForm.presencePenalty,
      frequency_penalty: modelForm.frequencyPenalty
    };
    const stopList = modelForm.stop
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    if (stopList.length) {
      completionParams.stop = stopList;
    }
    if (modelForm.responseFormat && modelForm.responseFormat !== 'text') {
      completionParams.response_format = { type: modelForm.responseFormat };
    }
    const payload: Api.Dify.ModelConfigPayload = {
      model: {
        ...base,
        completion_params: completionParams
      }
    };
    await updateDifyModelConfig(currentAppId.value, payload);
    window.$message?.success('模型参数已保存');
    await loadModelConfig();
  } catch {
    window.$message?.error('保存模型参数失败');
  } finally {
    modelSaving.value = false;
  }
}

// ===== Agent 策略（Dify /advanced-model） =====
const strategyLoading = ref(false);
const strategySaving = ref(false);
const strategyConfig = ref<Api.Dify.AdvancedModel | null>(null);
const strategyForm = reactive({
  enabled: true,
  strategy: 'function_call' as 'function_call' | 'react',
  maxIteration: 5,
  /** 引入/推理提示词（Dify agent_mode.prompt，增强推理引导） */
  prompt: ''
});

// API 访问（Dify /apps/{id}/api-keys）；声明提前到 watch(currentAppId) 之前，避免 no-use-before-define
const apiKeysLoading = ref(false);
const apiKeyCreating = ref(false);
const apiKeys = ref<Api.Dify.DifyAppApiKey[]>([]);

async function loadStrategyConfig() {
  if (currentAppId.value == null) return;
  strategyLoading.value = true;
  try {
    const res = await fetchDifyAdvancedModel(currentAppId.value);
    const cfg = (res?.data ?? null) as Api.Dify.AdvancedModel | null;
    strategyConfig.value = cfg;
    const am = (cfg?.agent_mode ?? {}) as Record<string, unknown>;
    strategyForm.enabled = Boolean(am.enabled ?? true);
    strategyForm.strategy = (am.strategy as 'function_call' | 'react') || 'function_call';
    strategyForm.maxIteration = Number(am.max_iteration ?? 5);
    strategyForm.prompt = String(am.prompt ?? '');
  } catch {
    window.$message?.warning('加载 Agent 策略失败（后端可能未代理 advanced-model）');
  } finally {
    strategyLoading.value = false;
  }
}

async function saveStrategyConfig() {
  if (currentAppId.value == null) return;
  strategySaving.value = true;
  try {
    const payload: Api.Dify.AdvancedModelPayload = {
      agent_mode: {
        enabled: strategyForm.enabled,
        strategy: strategyForm.strategy,
        max_iteration: strategyForm.maxIteration,
        ...(strategyForm.prompt.trim() ? { prompt: strategyForm.prompt } : {})
      }
    };
    await updateDifyAdvancedModel(currentAppId.value, payload);
    window.$message?.success('Agent 策略已保存');
    await loadStrategyConfig();
  } catch {
    window.$message?.error('保存 Agent 策略失败');
  } finally {
    strategySaving.value = false;
  }
}

watch(activeTab, tab => {
  if (tab === 'model' && !isWorkflow.value && !modelConfig.value && !modelLoading.value) loadModelConfig();
  if (tab === 'strategy' && isAgent.value && !strategyConfig.value && !strategyLoading.value) loadStrategyConfig();
});

watch(
  () => currentAppId.value,
  () => {
    modelConfig.value = null;
    strategyConfig.value = null;
    apiKeys.value = [];
    // 按应用类型裁剪 Tab：工作流无 模型参数/Agent 策略/知识库/提示词编排，停留到这些页时退回基础页
    if (isWorkflow.value && activeTab.value !== 'base' && activeTab.value !== 'api') {
      activeTab.value = 'base';
    } else if (activeTab.value === 'strategy' && !isAgent.value) {
      activeTab.value = 'base';
    }
    if (activeTab.value === 'model' && !isWorkflow.value) loadModelConfig();
    if (activeTab.value === 'strategy') loadStrategyConfig();
    if (activeTab.value === 'api') loadApiKeys();
  }
);

// ===== API 访问（Dify /apps/{id}/api-keys） =====
async function loadApiKeys() {
  if (currentAppId.value == null) return;
  apiKeysLoading.value = true;
  try {
    const res = await fetchDifyAppApiKeys(currentAppId.value);
    apiKeys.value = (res?.data ?? []) as Api.Dify.DifyAppApiKey[];
  } catch {
    window.$message?.warning('加载 API 访问密钥失败（后端可能未代理 api-keys）');
  } finally {
    apiKeysLoading.value = false;
  }
}

async function handleCreateApiKey() {
  if (currentAppId.value == null) return;
  apiKeyCreating.value = true;
  try {
    const res = await createDifyAppApiKey(currentAppId.value);
    const created = res?.data as Api.Dify.DifyAppApiKey | undefined;
    if (created?.token) {
      window.$dialog?.info({
        title: '新密钥已创建',
        content: `请立即复制保存，密钥仅展示一次：${created.token}`,
        positiveText: '复制并关闭',
        onPositiveClick: () => {
          window.navigator.clipboard?.writeText(created.token ?? '');
          window.$message?.success('已复制到剪贴板');
        }
      });
    }
    await loadApiKeys();
    window.$message?.success('API Key 已创建');
  } catch {
    window.$message?.error('创建 API Key 失败');
  } finally {
    apiKeyCreating.value = false;
  }
}

function copyApiToken(token?: string) {
  if (!token) return;
  window.navigator.clipboard?.writeText(token);
  window.$message?.success('已复制到剪贴板');
}

function formatTime(ts?: number) {
  return ts ? new Date(ts * 1000).toLocaleString() : '—';
}

const apiKeyColumns: DataTableColumns<Api.Dify.DifyAppApiKey> = [
  {
    title: '类型',
    key: 'type',
    width: 120,
    render: row => h(NTag, { size: 'small', bordered: false }, { default: () => row.type || 'app' })
  },
  {
    title: 'Token',
    key: 'token',
    ellipsis: { tooltip: true },
    render: row => (row.token ? String(row.token) : '—')
  },
  {
    title: '最近使用',
    key: 'last_used_at',
    width: 180,
    render: row => formatTime(Number(row.last_used_at ?? 0) || undefined)
  },
  {
    title: '创建时间',
    key: 'created_at',
    width: 180,
    render: row => formatTime(Number(row.created_at ?? 0) || undefined)
  },
  {
    title: '操作',
    key: 'actions',
    width: 110,
    render: row =>
      h(
        NButton,
        { size: 'small', text: true, type: 'primary', onClick: () => copyApiToken(row.token) },
        { default: () => '复制' }
      )
  }
];
</script>

<template>
  <div class="agent-domain-page" :class="{ 'agent-domain-page--dark': darkMode }">
    <div class="agent-shell">
      <aside class="agent-sidebar panel-surface">
        <AgentSidebar :active-key="agentKey" :agents="agentList" :loading="agentLoading" @select="handleSelect" />
      </aside>

      <section class="agent-main">
        <div class="panel-surface">
          <div class="panel-head">
            <SvgIcon :icon="selectedAgent.icon" class="panel-head__icon" />
            <span class="panel-head__title">{{ selectedAgent.name }}</span>
            <NTag
              size="small"
              round
              :bordered="false"
              class="type-tag"
              :style="{ color: typeColor, borderColor: typeColor + '66', background: typeColor + '1a' }"
            >
              {{ typeLabel }}
            </NTag>
            <div class="ml-auto flex gap-6px">
              <NButton secondary size="small" @click="handleOpenConsole">
                <template #icon>
                  <SvgIcon icon="mdi:open-in-new" />
                </template>
                前往编排
              </NButton>
              <NButton secondary size="small" @click="navigateToSubPage('agent_test')">测试</NButton>
              <NButton secondary size="small" @click="navigateToSubPage('agent_tools')">工具</NButton>
              <NButton secondary size="small" type="error" @click="handleDelete">删除</NButton>
            </div>
          </div>
          <div class="panel-body">
            <div v-if="isWorkflow" class="wf-banner">
              <div class="wf-banner__text">
                <div class="wf-banner__title">工作流应用</div>
                <div class="wf-banner__desc">
                  工作流的模型、提示词、节点与知识库均在编排画布中按节点独立配置，不存在应用级统一配置。
                </div>
              </div>
              <NButton type="primary" size="small" @click="handleOpenConsole">
                <template #icon>
                  <SvgIcon icon="mdi:workflow" />
                </template>
                前往编排画布
              </NButton>
            </div>

            <div class="cfg-tabs">
              <button
                v-for="tab in visibleTabs"
                :key="tab.key"
                class="cfg-tab"
                :class="{ 'cfg-tab--active': activeTab === tab.key }"
                type="button"
                @click="activeTab = tab.key"
              >
                <SvgIcon :icon="tab.icon" class="cfg-tab__icon" />
                {{ tab.label }}
              </button>
            </div>

            <div v-show="activeTab === 'base'" class="cfg-panel">
              <div class="section-desc">维护应用基础信息、类型、描述与启用状态；模型与连接凭据由系统自动管理。</div>
              <AgentConfigForm v-model:loading="saving" :agent-key="agentKey" @submit="handleSubmit" />
            </div>

            <div v-show="activeTab === 'model'" class="cfg-panel">
              <div class="section-desc">
                配置生成模型的采样参数。模型与供应商由系统自动关联（本期后端暂未代理该能力）。
              </div>
              <div v-if="isWorkflow" class="cfg-workflow-hint">
                <p>工作流应用的模型参数按节点独立配置，不存在工作流级统一参数。</p>
                <p>请在编排控制台的工作流画布中，分别对每个 LLM 节点设置模型与采样参数。</p>
                <NButton type="primary" size="small" @click="handleOpenConsole">
                  前往编排
                  <template #icon>
                    <SvgIcon icon="mdi:open-in-new" />
                  </template>
                </NButton>
              </div>
              <div v-else-if="modelLoading" class="section-desc">加载中…</div>
              <template v-else>
                <div class="kv-row">
                  <span class="kv-label">当前模型</span>
                  <span class="kv-value">{{ modelMeta.provider || '—' }} / {{ modelMeta.name || '—' }}</span>
                </div>
                <div class="cfg-field">
                  <label class="cfg-field__label">Temperature</label>
                  <div class="cfg-field__control">
                    <NInputNumber v-model:value="modelForm.temperature" :min="0" :max="1" :step="0.1" class="w-200px" />
                    <span class="field-tip">采样随机度 0~1，越高越发散</span>
                  </div>
                </div>
                <div class="cfg-field">
                  <label class="cfg-field__label">Top P</label>
                  <div class="cfg-field__control">
                    <NInputNumber v-model:value="modelForm.topP" :min="0" :max="1" :step="0.05" class="w-200px" />
                    <span class="field-tip">核采样阈值 0~1</span>
                  </div>
                </div>
                <div class="cfg-field">
                  <label class="cfg-field__label">Max Tokens</label>
                  <div class="cfg-field__control">
                    <NInputNumber v-model:value="modelForm.maxTokens" :min="1" :max="32000" class="w-200px" />
                  </div>
                </div>
                <div class="cfg-field">
                  <label class="cfg-field__label">Presence Penalty</label>
                  <div class="cfg-field__control">
                    <NInputNumber
                      v-model:value="modelForm.presencePenalty"
                      :min="-2"
                      :max="2"
                      :step="0.1"
                      class="w-200px"
                    />
                  </div>
                </div>
                <div class="cfg-field">
                  <label class="cfg-field__label">Frequency Penalty</label>
                  <div class="cfg-field__control">
                    <NInputNumber
                      v-model:value="modelForm.frequencyPenalty"
                      :min="-2"
                      :max="2"
                      :step="0.1"
                      class="w-200px"
                    />
                  </div>
                </div>
                <div class="cfg-field">
                  <label class="cfg-field__label">Stop 序列</label>
                  <div class="cfg-field__control">
                    <NInput
                      v-model:value="modelForm.stop"
                      class="w-280px"
                      placeholder="多个停止词用英文逗号分隔，如：END,###"
                    />
                    <span class="field-tip">遇到该序列即停止生成，逗号分隔</span>
                  </div>
                </div>
                <div class="cfg-field">
                  <label class="cfg-field__label">响应格式</label>
                  <div class="cfg-field__control">
                    <NSelect
                      v-model:value="modelForm.responseFormat"
                      class="w-200px"
                      :options="[
                        { label: '文本 (text)', value: 'text' },
                        { label: 'JSON 对象 (json_object)', value: 'json_object' }
                      ]"
                    />
                  </div>
                </div>
                <div class="cfg-actions">
                  <NButton type="primary" :loading="modelSaving" @click="saveModelConfig">保存模型参数</NButton>
                </div>
              </template>
            </div>

            <div v-show="activeTab === 'strategy'" class="cfg-panel">
              <div class="section-desc">配置 Agent 的推理策略与最大迭代轮数。</div>
              <div v-if="strategyLoading" class="section-desc">加载中…</div>
              <template v-else>
                <div class="cfg-field">
                  <label class="cfg-field__label">启用策略</label>
                  <div class="cfg-field__control">
                    <NSwitch v-model:checked="strategyForm.enabled" />
                  </div>
                </div>
                <div class="cfg-field">
                  <label class="cfg-field__label">推理策略</label>
                  <div class="cfg-field__control">
                    <NSelect
                      v-model:value="strategyForm.strategy"
                      :options="[
                        { label: 'Function Call', value: 'function_call' },
                        { label: 'ReAct', value: 'react' }
                      ]"
                      class="w-240px"
                    />
                  </div>
                </div>
                <div class="cfg-field">
                  <label class="cfg-field__label">最大迭代轮数</label>
                  <div class="cfg-field__control">
                    <NInputNumber v-model:value="strategyForm.maxIteration" :min="1" :max="20" class="w-200px" />
                  </div>
                </div>
                <div class="cfg-field cfg-field--top">
                  <label class="cfg-field__label">引入提示词</label>
                  <div class="cfg-field__control">
                    <NInput
                      v-model:value="strategyForm.prompt"
                      type="textarea"
                      :autosize="{ minRows: 3, maxRows: 8 }"
                      class="w-420px"
                      placeholder="用于引导 Agent 的推理策略与工具选择（可空）"
                    />
                  </div>
                </div>
                <div class="cfg-actions">
                  <NButton type="primary" :loading="strategySaving" @click="saveStrategyConfig">保存策略</NButton>
                </div>
              </template>
            </div>

            <div v-if="activeTab === 'knowledge'" class="cfg-panel">
              <AgentDatasetBinding :app-id="currentAppId" />
            </div>

            <div v-if="activeTab === 'prompt'" class="cfg-panel">
              <AgentPromptEditor :app-id="currentAppId" />
            </div>

            <div v-if="activeTab === 'api'" class="cfg-panel">
              <div class="section-desc">
                管理该应用的 API 访问密钥，供外部系统通过 Service API 调用。密钥完整值仅创建时展示一次，请妥善保存。
              </div>
              <div class="api-actions">
                <NButton type="primary" :loading="apiKeyCreating" @click="handleCreateApiKey">新建 API Key</NButton>
              </div>
              <div v-if="apiKeysLoading" class="section-desc">加载中…</div>
              <template v-else>
                <NEmpty v-if="!apiKeys.length" description="暂无 API 访问密钥" size="small" class="mt-16px" />
                <NDataTable
                  v-else
                  class="api-key-table mt-16px"
                  :columns="apiKeyColumns"
                  :data="apiKeys"
                  :row-key="(row: Api.Dify.DifyAppApiKey) => String(row.id ?? '')"
                  :bordered="false"
                />
              </template>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped lang="scss">
.agent-domain-page {
  height: 100%;
  background: var(--agent-page-bg);
  color: #eaf5ff;
  overflow: auto;
}

.agent-domain-page--dark {
  color-scheme: dark;
}

.agent-shell {
  height: 100%;
  display: grid;
  grid-template-columns: 248px minmax(0, 1fr);
  gap: 10px;
  padding: 12px 14px;
  box-sizing: border-box;
}

.agent-sidebar {
  min-width: 0;
  overflow: visible;
}

.agent-main {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 10px;
}

.section-desc {
  font-size: 12px;
  color: rgba(203, 227, 255, 0.65);
}

.type-tag {
  margin-left: 8px;
}

.wf-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 16px;
  margin-bottom: 16px;
  border: 1px solid rgba(52, 211, 153, 0.3);
  border-radius: 8px;
  background: rgba(6, 20, 38, 0.5);

  &__title {
    font-size: 14px;
    font-weight: 700;
    color: #eaf5ff;
  }

  &__desc {
    margin-top: 2px;
    font-size: 12px;
    line-height: 1.5;
    color: rgba(203, 227, 255, 0.6);
  }
}

.cfg-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  border-bottom: 1px solid var(--agent-line);
}

.cfg-tab {
  appearance: none;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: transparent;
  border: none;
  padding: 8px 14px;
  margin-bottom: -1px;
  color: rgba(203, 227, 255, 0.6);
  cursor: pointer;
  font-size: 14px;
  border-bottom: 2px solid transparent;
  transition:
    color 0.2s,
    border-color 0.2s;

  &__icon {
    font-size: 16px;
  }
}

.cfg-tab:hover {
  color: #eaf5ff;
}

.cfg-tab--active {
  color: var(--agent-accent);
  border-bottom-color: var(--agent-accent);

  .cfg-tab__icon {
    color: var(--agent-accent);
  }
}

.cfg-panel {
  padding-top: 4px;
}

.cfg-workflow-hint {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 14px;
  border: 1px dashed rgba(203, 227, 255, 0.25);
  border-radius: 8px;
  font-size: 13px;
  line-height: 1.7;
  color: rgba(203, 227, 255, 0.75);
}

.cfg-workflow-hint p {
  margin: 0;
}

.cfg-field {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 14px;
}

.cfg-field__label {
  width: 120px;
  color: rgba(203, 227, 255, 0.6);
  font-size: 13px;
}
.cfg-field--top {
  align-items: flex-start;
}
.w-420px {
  width: 420px;
  max-width: 100%;
}

.cfg-field__control {
  display: flex;
  align-items: center;
  gap: 10px;
}

.kv-row {
  display: flex;
  gap: 16px;
  margin-bottom: 14px;
  font-size: 13px;
}

.kv-label {
  width: 120px;
  color: rgba(203, 227, 255, 0.6);
}

.kv-value {
  color: #eaf5ff;
  font-weight: 500;
}

.cfg-actions {
  margin-top: 8px;
}

.w-200px {
  width: 200px;
}

.w-240px {
  width: 240px;
}

.api-actions {
  margin-bottom: 4px;
}

.api-key-table {
  max-width: 720px;
}

.mt-16px {
  margin-top: 16px;
}

@media (max-width: 1199px) {
  .agent-shell {
    grid-template-columns: 1fr;
  }

  .agent-sidebar {
    max-height: 280px;
  }
}
</style>
