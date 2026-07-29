<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { NButton, NSwitch, NTag, NEmpty, NSpin, NTabs, NTabPane } from 'naive-ui';
import SvgIcon from '@/components/custom/svg-icon.vue';
import { useAgentSelection } from './use-agent';
import { useDifyApps } from './use-dify-app';
import AgentSidebar from './agent-sidebar.vue';
import {
  fetchDifyTools,
  fetchDifyAppTools,
  fetchDifyMcpServers,
  bindDifyAppTools,
  unbindDifyAppTool
} from '@/service/api/difyApp';

const route = useRoute();
const router = useRouter();
const { resolveAgent, agentList, deleteAgent } = useDifyApps();
const { agentKey, selectedAgent, updateAgentQuery } = useAgentSelection(route, router, resolveAgent, agentList);

const appId = computed(() => (selectedAgent.value.key ? Number(selectedAgent.value.key) : null));
const currentAppId = computed(() => appId.value);

const loading = ref(false);
const saving = ref(false);
const proxyMissing = ref(false);

const availableTools = ref<Array<Record<string, unknown>>>([]);
const boundToolIds = ref<string[]>([]);
const mcpServers = ref<Array<Record<string, unknown>>>([]);

function toolId(t: Record<string, unknown>) {
  return String(t.id ?? t.name ?? '');
}
function toolName(t: Record<string, unknown>) {
  return String(t.name ?? t.label ?? '未命名工具');
}
function toolType(t: Record<string, unknown>) {
  return String(t.type ?? '');
}
function mcpName(m: Record<string, unknown>) {
  return String(m.name ?? '未命名 MCP 服务');
}
function mcpDesc(m: Record<string, unknown>) {
  return String(m.description ?? '');
}
function mcpToolCount(m: Record<string, unknown>) {
  return Array.isArray(m.tools) ? (m.tools as unknown[]).length : 0;
}

async function load() {
  if (currentAppId.value == null) return;
  loading.value = true;
  proxyMissing.value = false;
  try {
    const [allRes, boundRes, mcpRes] = await Promise.all([
      fetchDifyTools(),
      fetchDifyAppTools(currentAppId.value),
      fetchDifyMcpServers()
    ]);
    const rawAll = allRes?.data as unknown;
    availableTools.value = (Array.isArray(rawAll) ? rawAll : ((rawAll as { data?: unknown })?.data ?? [])) as Array<
      Record<string, unknown>
    >;
    const rawBound = boundRes?.data as unknown;
    const boundPayload = (Array.isArray(rawBound) ? rawBound : ((rawBound as { data?: unknown })?.data ?? [])) as Array<
      Record<string, unknown>
    >;
    boundToolIds.value = boundPayload.map(toolId);
    const rawMcp = mcpRes?.data as unknown;
    mcpServers.value = (Array.isArray(rawMcp) ? rawMcp : ((rawMcp as { data?: unknown })?.data ?? [])) as Array<
      Record<string, unknown>
    >;
  } catch {
    proxyMissing.value = true;
    window.$message?.warning('加载工具 / MCP 失败（后端可能未代理相关接口）');
  } finally {
    loading.value = false;
  }
}

watch(() => selectedAgent.value.key, load, { immediate: true });

const boundToolSet = computed(() => new Set(boundToolIds.value));

async function toggleTool(t: Record<string, unknown>, next: boolean) {
  if (currentAppId.value == null) return;
  const id = toolId(t);
  const nextIds = next ? [...new Set([...boundToolIds.value, id])] : boundToolIds.value.filter(x => x !== id);
  saving.value = true;
  try {
    if (next) {
      await bindDifyAppTools(currentAppId.value, nextIds);
    } else {
      await unbindDifyAppTool(currentAppId.value, id);
    }
    boundToolIds.value = nextIds;
    window.$message?.success(next ? '已启用工具' : '已停用工具');
  } catch {
    window.$message?.error('操作失败，请确认后端已代理 /apps/{id}/tools');
  } finally {
    saving.value = false;
  }
}

function navigateToSubPage(name: 'agent_config' | 'agent_test') {
  router.push({
    name: name as never,
    query: { ...route.query, agent: agentKey.value }
  });
}

async function handleDelete() {
  const target = selectedAgent.value;
  const id = Number(target.key);
  if (!id || Number.isNaN(id)) return;
  window.$dialog?.warning({
    title: '删除智能体',
    content: `确定要删除「${target.name}」吗？删除后无法恢复。`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      const ok = await deleteAgent(id);
      if (ok) {
        router.push({ name: 'agent_workbench' as never });
      }
    }
  });
}
</script>

<template>
  <div class="agent-config">
    <AgentSidebar
      :agent-list="agentList"
      :active-key="agentKey"
      class="agent-config__sidebar"
      @select="updateAgentQuery"
      @create="router.push({ name: 'agent_workbench' as never, query: { create: '1' } })"
      @refresh="router.push({ name: 'agent_workbench' as never, query: { refresh: '1' } })"
    />

    <div class="panel panel-surface">
      <div class="panel-head">
        <SvgIcon icon="mdi:puzzle-outline" class="panel-head__icon" />
        <span class="panel-head__title">{{ selectedAgent.name }}· 工具 / MCP</span>
        <div class="ml-auto flex gap-6px">
          <NButton text size="small" @click="router.push({ name: 'agent_workbench' as never })">返回工作台</NButton>
          <NButton secondary size="small" @click="navigateToSubPage('agent_config')">配置</NButton>
          <NButton secondary size="small" @click="navigateToSubPage('agent_test')">测试</NButton>
          <NButton secondary size="small" type="error" @click="handleDelete">删除</NButton>
        </div>
      </div>

      <div class="panel-body">
        <NTabs type="line" animated>
          <NTabPane name="tools" tab="工具">
            <NSpin :show="loading">
              <div v-if="proxyMissing" class="section-desc warn">
                后端尚未代理「工具」相关接口（/tools、/apps/{id}/tools），暂无法读写。
              </div>
              <div v-else-if="availableTools.length === 0" class="agent-empty">
                <NEmpty description="暂无可用的工具" />
              </div>
              <ul v-else class="tool-list">
                <li v-for="t in availableTools" :key="toolId(t)" class="tool-item">
                  <div class="tool-item__main">
                    <SvgIcon icon="mdi:wrench-outline" class="tool-item__icon" />
                    <div class="tool-item__text">
                      <div class="tool-item__name">{{ toolName(t) }}</div>
                      <div class="tool-item__sub">
                        <NTag v-if="toolType(t)" size="small" round>{{ toolType(t) }}</NTag>
                      </div>
                    </div>
                  </div>
                  <NSwitch
                    :value="boundToolSet.has(toolId(t))"
                    :loading="saving"
                    @update:value="val => toggleTool(t, val)"
                  />
                </li>
              </ul>
            </NSpin>
          </NTabPane>

          <NTabPane name="mcp" tab="MCP 服务">
            <NSpin :show="loading">
              <div v-if="proxyMissing" class="section-desc warn">后端尚未代理 MCP 接口（/mcp），暂无法读取。</div>
              <div v-else-if="mcpServers.length === 0" class="agent-empty">
                <NEmpty description="暂未接入 MCP 服务" />
              </div>
              <ul v-else class="tool-list">
                <li v-for="m in mcpServers" :key="mcpName(m)" class="tool-item">
                  <div class="tool-item__main">
                    <SvgIcon icon="mdi:server-network" class="tool-item__icon" />
                    <div class="tool-item__text">
                      <div class="tool-item__name">{{ mcpName(m) }}</div>
                      <div class="tool-item__sub">
                        <NTag size="small" round>{{ mcpToolCount(m) }} 个工具</NTag>
                        <span v-if="mcpDesc(m)" class="tool-item__desc">{{ mcpDesc(m) }}</span>
                      </div>
                    </div>
                  </div>
                </li>
              </ul>
            </NSpin>
          </NTabPane>
        </NTabs>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.agent-config {
  display: flex;
  height: 100%;
  gap: 12px;
}
.agent-config__sidebar {
  width: 240px;
  flex-shrink: 0;
  border-right: 1px solid var(--line, rgba(25, 95, 176, 0.35));
  padding-right: 12px;
}
.panel {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.panel-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 16px;
  color: #eaf5ff;
}
.section-desc {
  font-size: 12px;
  color: rgba(203, 227, 255, 0.65);
  margin-bottom: 12px;
}
.section-desc.warn {
  color: #ffce8a;
}

.tool-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.tool-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid rgba(25, 95, 176, 0.35);
  border-radius: var(--agent-radius-sm);
  background: rgba(7, 28, 52, 0.5);
  transition:
    border-color 0.2s ease,
    background 0.2s ease,
    transform 0.2s ease,
    box-shadow 0.2s ease;
}

.tool-item:hover {
  border-color: rgba(61, 166, 255, 0.32);
  background: rgba(10, 32, 58, 0.6);
  box-shadow: 0 6px 20px rgba(2, 10, 22, 0.4);
  transform: translateY(-1px);
}
.tool-item__main {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.tool-item__icon {
  font-size: 18px;
  color: var(--agent-accent);
  filter: drop-shadow(0 0 6px rgba(52, 168, 255, 0.3));
}
.tool-item__text {
  min-width: 0;
}
.tool-item__name {
  font-weight: 600;
}
.tool-item__sub {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
  font-size: 12px;
  color: rgba(203, 227, 255, 0.6);
}
.tool-item__desc {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 360px;
}
</style>
