<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useThemeStore } from '@/store/modules/theme';
import SvgIcon from '@/components/custom/svg-icon.vue';
import { fetchDifyAppUpdate } from '@/service/api/difyApp';
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
const { resolveAgent, agentList, loading: agentLoading, loadRealApps, deleteAgent } = useDifyApps();
const { agentKey, selectedAgent, updateAgentQuery } = useAgentSelection(route, router, resolveAgent, agentList);
const saving = ref(false);

function handleSelect(key: typeof agentKey.value) {
  updateAgentQuery(key);
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
  const appId = Number(target.key);
  if (!appId || Number.isNaN(appId)) return;
  window.$dialog?.warning({
    title: '删除智能体',
    content: `确定要删除「${target.name}」吗？删除后无法恢复。`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      const ok = await deleteAgent(appId);
      if (ok) {
        router.push({ name: 'agent_workbench' as never });
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

// ===== 模型参数（Dify /model-config） =====
const activeTab = ref<'base' | 'model' | 'strategy' | 'knowledge' | 'prompt'>('base');
const isAgent = computed(() => (selectedAgent.value?.appType ?? 0) === 2);
const currentAppId = computed(() => {
  const key = selectedAgent.value?.key;
  return key ? Number(key) : null;
});

const modelLoading = ref(false);
const modelSaving = ref(false);
const modelConfig = ref<Api.Dify.ModelConfig | null>(null);
const modelMeta = reactive({ provider: '', name: '' });
const modelForm = reactive({
  temperature: 0.7,
  topP: 1,
  maxTokens: 1000,
  presencePenalty: 0,
  frequencyPenalty: 0
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
    const payload: Api.Dify.ModelConfigPayload = {
      model: {
        ...base,
        completion_params: {
          temperature: modelForm.temperature,
          top_p: modelForm.topP,
          max_tokens: modelForm.maxTokens,
          presence_penalty: modelForm.presencePenalty,
          frequency_penalty: modelForm.frequencyPenalty
        }
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
  maxIteration: 5
});

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
        max_iteration: strategyForm.maxIteration
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
  if (tab === 'model' && !modelConfig.value && !modelLoading.value) loadModelConfig();
  if (tab === 'strategy' && isAgent.value && !strategyConfig.value && !strategyLoading.value) loadStrategyConfig();
});

watch(
  () => currentAppId.value,
  () => {
    modelConfig.value = null;
    strategyConfig.value = null;
    if (activeTab.value === 'model') loadModelConfig();
    if (activeTab.value === 'strategy') loadStrategyConfig();
  }
);
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
            <span class="panel-head__title">{{ selectedAgent.name }}配置中心</span>
            <div class="ml-auto flex gap-6px">
              <NButton secondary size="small" @click="navigateToSubPage('agent_test')">测试</NButton>
              <NButton secondary size="small" @click="navigateToSubPage('agent_tools')">工具</NButton>
              <NButton secondary size="small" type="error" @click="handleDelete">删除</NButton>
            </div>
          </div>
          <div class="panel-body">
            <div class="cfg-tabs">
              <button
                class="cfg-tab"
                :class="{ 'cfg-tab--active': activeTab === 'base' }"
                type="button"
                @click="activeTab = 'base'"
              >
                基础信息
              </button>
              <button
                class="cfg-tab"
                :class="{ 'cfg-tab--active': activeTab === 'model' }"
                type="button"
                @click="activeTab = 'model'"
              >
                模型参数
              </button>
              <button
                v-if="isAgent"
                class="cfg-tab"
                :class="{ 'cfg-tab--active': activeTab === 'strategy' }"
                type="button"
                @click="activeTab = 'strategy'"
              >
                Agent 策略
              </button>
              <button
                class="cfg-tab"
                :class="{ 'cfg-tab--active': activeTab === 'knowledge' }"
                type="button"
                @click="activeTab = 'knowledge'"
              >
                知识库
              </button>
              <button
                class="cfg-tab"
                :class="{ 'cfg-tab--active': activeTab === 'prompt' }"
                type="button"
                @click="activeTab = 'prompt'"
              >
                提示词编排
              </button>
            </div>

            <div v-show="activeTab === 'base'" class="cfg-panel">
              <div class="section-desc">
                维护应用基础信息、类型、描述与启用状态；模型与连接凭据请在「AI 配置」中管理。
              </div>
              <AgentConfigForm v-model:loading="saving" :agent-key="agentKey" @submit="handleSubmit" />
            </div>

            <div v-show="activeTab === 'model'" class="cfg-panel">
              <div class="section-desc">
                配置生成模型的采样参数。模型与供应商需在「AI 配置 → 模型供应商」中设置（本期后端暂未代理该能力）。
              </div>
              <div v-if="modelLoading" class="section-desc">加载中…</div>
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

.cfg-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  border-bottom: 1px solid var(--agent-line);
}

.cfg-tab {
  appearance: none;
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
}

.cfg-tab:hover {
  color: #eaf5ff;
}

.cfg-tab--active {
  color: var(--agent-accent);
  border-bottom-color: var(--agent-accent);
}

.cfg-panel {
  padding-top: 4px;
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

@media (max-width: 1199px) {
  .agent-shell {
    grid-template-columns: 1fr;
  }

  .agent-sidebar {
    max-height: 280px;
  }
}
</style>
