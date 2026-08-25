<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { NButton, NSwitch, NTag, NInput, NTabs, NTabPane, NModal, NForm, NFormItem } from 'naive-ui';
import SvgIcon from '@/components/custom/svg-icon.vue';
import { useAgentSelection } from './use-agent';
import { useDifyApps } from './use-dify-app';
import AgentSidebar from './agent-sidebar.vue';
import {
  fetchDifyTools,
  fetchDifyAppTools,
  fetchDifyMcpServers,
  createDifyMcpServer,
  deleteDifyMcpServer,
  bindDifyAppTools,
  unbindDifyAppTool
} from '@/service/api/difyApp';

const route = useRoute();
const router = useRouter();
const { resolveAgent, agentList, loading: agentLoading, deleteAgent } = useDifyApps();
const { agentKey, selectedAgent, updateAgentQuery } = useAgentSelection(route, router, resolveAgent, agentList);

const appId = computed(() => selectedAgent.value.key || null);
const currentAppId = computed(() => appId.value);

const loading = ref(false);
const saving = ref(false);
const proxyMissing = ref(false);

/** 搜索关键字（按名称/提供方/描述过滤） */
const searchText = ref('');
/** 工具启用状态筛选：all | bound | unbound */
const filterMode = ref<'all' | 'bound' | 'unbound'>('all');
const availableTools = ref<Array<Record<string, unknown>>>([]);
const boundToolIds = ref<string[]>([]);
const mcpServers = ref<Array<Record<string, unknown>>>([]);
const boundCount = computed(() => boundToolIds.value.length);

const filteredTools = computed(() => {
  const kw = searchText.value.trim().toLowerCase();
  return availableTools.value.filter(t => {
    const bound = isBound(t);
    if (filterMode.value === 'bound' && !bound) return false;
    if (filterMode.value === 'unbound' && bound) return false;
    if (!kw) return true;
    const hay =
      `${toolName(t)} ${toolProvider(t)} ${toolCategory(t)} ${toolType(t)} ${toolDescription(t)}`.toLowerCase();
    return hay.includes(kw);
  });
});

/** 按工具名生成确定性色相，让不同工具在图标底色上有区分度 */
const palette = ['#38bdf8', '#8b5cf6', '#34d399', '#f59e0b', '#f472b6', '#60a5fa', '#2dd4bf', '#a78bfa'];
function toolColor(t: Record<string, unknown>) {
  let h = 0;
  const s = toolName(t);
  for (let i = 0; i < s.length; i += 1) {
    h = (h * 31 + s.charCodeAt(i)) % 997;
  }
  return palette[h % palette.length];
}

const typeLabel = computed(() => {
  const t = selectedAgent.value?.appType;
  if (t === 3) return '工作流';
  if (t === 2) return 'Agent';
  return '聊天助手';
});
const typeColor = computed(() => {
  const t = selectedAgent.value?.appType;
  if (t === 3) return '#34d399';
  if (t === 2) return '#8b5cf6';
  return '#38bdf8';
});

/** 已绑定工具 id 集合（用于快速判定） */
const boundToolSet = computed(() => new Set(boundToolIds.value));

/** 工具是否已绑定 */
function isBound(t: Record<string, unknown>) {
  return boundToolSet.value.has(toolId(t));
}

function toolId(t: Record<string, unknown>) {
  return String(t.id ?? t.name ?? '');
}
function toolName(t: Record<string, unknown>) {
  return String(t.name ?? t.label ?? '未命名工具');
}
function toolType(t: Record<string, unknown>) {
  return String(t.type ?? '');
}
function toolProvider(t: Record<string, unknown>) {
  return String(t.provider_name ?? t.provider ?? '');
}
function toolCategory(t: Record<string, unknown>) {
  return String(t.category ?? '');
}
function toolDescription(t: Record<string, unknown>) {
  return String(t.description ?? '');
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
      fetchDifyTools(currentAppId.value ?? undefined),
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

/** ── MCP 服务接入管理 ── */
const mcpModalVisible = ref(false);
const mcpSaving = ref(false);
const mcpForm = reactive({
  name: '',
  server_url: '',
  headers: ''
});

function openMcpModal() {
  mcpForm.name = '';
  mcpForm.server_url = '';
  mcpForm.headers = '';
  mcpModalVisible.value = true;
}

async function handleCreateMcp(): Promise<boolean> {
  if (!mcpForm.name.trim() || !mcpForm.server_url.trim()) {
    window.$message?.warning('请填写 MCP 服务名称与服务器地址');
    return false;
  }
  mcpSaving.value = true;
  try {
    const headers: Record<string, string> = {};
    for (const line of mcpForm.headers.split('\n')) {
      const idx = line.indexOf(':');
      if (idx > 0) {
        headers[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
      }
    }
    await createDifyMcpServer({
      name: mcpForm.name.trim(),
      server_url: mcpForm.server_url.trim(),
      ...(Object.keys(headers).length ? { headers } : {})
    });
    window.$message?.success('已添加 MCP 服务');
    mcpModalVisible.value = false;
    await load();
    return true;
  } catch {
    window.$message?.error('添加失败，请确认服务地址可达且后端已代理 MCP 管理接口');
    return false;
  } finally {
    mcpSaving.value = false;
  }
}

function handleDeleteMcp(m: Record<string, unknown>) {
  const id = String(m.id ?? '');
  if (!id) return;
  window.$dialog?.warning({
    title: '删除 MCP 服务',
    content: `确定要删除「${mcpName(m)}」吗？该服务下的工具将不可用。`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await deleteDifyMcpServer(id);
        window.$message?.success('已删除 MCP 服务');
        await load();
      } catch {
        window.$message?.error('删除失败，请确认后端已代理 MCP 管理接口');
      }
    }
  });
}

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

function handleSelect(key: typeof agentKey.value) {
  updateAgentQuery(key);
}

async function handleDelete() {
  const target = selectedAgent.value;
  const id = target.key;
  if (!id) return;
  window.$dialog?.warning({
    title: '删除智能体',
    content: `确定要删除「${target.name}」吗？删除后无法恢复。`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      const ok = await deleteAgent(id);
      if (ok) {
        router.push({ name: 'agent_index' as never });
      }
    }
  });
}
</script>

<template>
  <div class="agent-config">
    <aside class="agent-config__sidebar panel-surface">
      <AgentSidebar :active-key="agentKey" :agents="agentList" :loading="agentLoading" @select="handleSelect" />
    </aside>

    <div class="panel panel-surface">
      <div class="panel-head">
        <SvgIcon icon="mdi:puzzle-outline" class="panel-head__icon" />
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
        <span class="section-desc" style="margin-left: 10px">工具与 MCP</span>
        <div class="ml-auto flex gap-6px">
          <NButton secondary size="small" @click="navigateToSubPage('agent_config')">配置</NButton>
          <NButton secondary size="small" @click="navigateToSubPage('agent_test')">测试</NButton>
          <NButton secondary size="small" type="error" @click="handleDelete">删除</NButton>
        </div>
      </div>

      <div class="panel-body">
        <NTabs type="line" animated>
          <NTabPane name="tools" tab="工具">
            <div v-if="proxyMissing" class="section-desc warn">
              后端尚未代理「工具」相关接口（/tools、/apps/{id}/tools），暂无法读写。
            </div>

            <template v-else>
              <!-- 统计 + 工具栏 -->
              <div v-if="!loading && availableTools.length" class="tool-bar">
                <div class="tool-bar__stats">
                  <span class="stat stat--all">{{ availableTools.length }}</span>
                  <span class="stat-label">全部</span>
                  <span class="stat stat--bound">{{ boundCount }}</span>
                  <span class="stat-label">已启用</span>
                </div>
                <div class="tool-bar__filters">
                  <button
                    type="button"
                    class="filter-btn"
                    :class="{ 'is-on': filterMode === 'all' }"
                    @click="filterMode = 'all'"
                  >
                    全部
                  </button>
                  <button
                    type="button"
                    class="filter-btn"
                    :class="{ 'is-on': filterMode === 'bound' }"
                    @click="filterMode = 'bound'"
                  >
                    已启用
                  </button>
                  <button
                    type="button"
                    class="filter-btn"
                    :class="{ 'is-on': filterMode === 'unbound' }"
                    @click="filterMode = 'unbound'"
                  >
                    未启用
                  </button>
                </div>
                <NInput
                  v-model:value="searchText"
                  placeholder="搜索工具名称 / 提供方 / 描述"
                  clearable
                  size="small"
                  class="tool-bar__search"
                >
                  <template #prefix>
                    <SvgIcon icon="mdi:magnify" />
                  </template>
                </NInput>
              </div>

              <!-- 加载骨架 -->
              <div v-if="loading" class="tool-skeleton">
                <div v-for="i in 8" :key="i" class="tool-skeleton__card" />
              </div>

              <!-- 空态 -->
              <div v-else-if="availableTools.length === 0" class="agent-empty custom-empty">
                <div class="custom-empty__icon">
                  <SvgIcon icon="mdi:tools" />
                </div>
                <div class="custom-empty__title">暂无可用的工具</div>
                <div class="custom-empty__desc">当前应用未配置可调用的工具，或后端未代理工具接口</div>
              </div>

              <!-- 搜索无结果 -->
              <div v-else-if="filteredTools.length === 0" class="agent-empty custom-empty">
                <div class="custom-empty__icon">
                  <SvgIcon icon="mdi:magnify-close" />
                </div>
                <div class="custom-empty__title">未找到匹配的工具</div>
                <div class="custom-empty__desc">换个关键词试试，或切换到「全部」筛选</div>
              </div>

              <!-- 工具卡片网格 -->
              <div v-else class="tool-grid">
                <div
                  v-for="t in filteredTools"
                  :key="toolId(t)"
                  class="tool-card"
                  :class="{ 'tool-card--bound': isBound(t) }"
                >
                  <div class="tool-card__head">
                    <div
                      class="tool-card__avatar"
                      :class="{ 'is-bound': isBound(t) }"
                      :style="
                        isBound(t)
                          ? {}
                          : { color: toolColor(t), borderColor: toolColor(t) + '44', background: toolColor(t) + '1a' }
                      "
                    >
                      <SvgIcon icon="mdi:tools" />
                    </div>
                    <NSwitch
                      :value="isBound(t)"
                      :loading="saving"
                      size="small"
                      @update:value="val => toggleTool(t, val)"
                    />
                  </div>
                  <div class="tool-card__name" :title="toolName(t)">{{ toolName(t) }}</div>
                  <div class="tool-card__desc" :title="toolDescription(t)">
                    {{ toolDescription(t) || '暂无描述' }}
                  </div>
                  <div class="tool-card__tags">
                    <NTag v-if="toolType(t)" size="tiny" round :bordered="false" class="tag-type">
                      {{ toolType(t) }}
                    </NTag>
                    <NTag v-if="toolProvider(t)" size="tiny" round :bordered="false" class="tag-provider">
                      {{ toolProvider(t) }}
                    </NTag>
                    <NTag v-if="toolCategory(t)" size="tiny" round :bordered="false" class="tag-category">
                      {{ toolCategory(t) }}
                    </NTag>
                  </div>
                </div>
              </div>
            </template>
          </NTabPane>

          <NTabPane name="mcp" tab="MCP 服务">
            <div v-if="proxyMissing" class="section-desc warn">后端尚未代理 MCP 接口（/mcp），暂无法读取。</div>

            <template v-else>
              <div v-if="!loading && mcpServers.length" class="tool-bar">
                <div class="tool-bar__stats">
                  <span class="stat stat--all">{{ mcpServers.length }}</span>
                  <span class="stat-label">MCP 服务</span>
                </div>
                <div class="ml-auto">
                  <NButton size="small" secondary type="primary" @click="openMcpModal">
                    <template #icon>
                      <SvgIcon icon="mdi:plus" />
                    </template>
                    添加 MCP 服务
                  </NButton>
                </div>
              </div>

              <div v-if="loading" class="tool-skeleton">
                <div v-for="i in 4" :key="i" class="tool-skeleton__card" />
              </div>

              <div v-else-if="mcpServers.length === 0" class="agent-empty custom-empty">
                <div class="custom-empty__icon">
                  <SvgIcon icon="mdi:server-network-off" />
                </div>
                <div class="custom-empty__title">暂未接入 MCP 服务</div>
                <div class="custom-empty__desc">可在此直接接入外部 MCP 服务（SSE / Streamable HTTP）</div>
                <NButton size="small" secondary type="primary" class="mt-12px" @click="openMcpModal">
                  <template #icon>
                    <SvgIcon icon="mdi:plus" />
                  </template>
                  添加 MCP 服务
                </NButton>
              </div>

              <div v-else class="tool-grid">
                <div v-for="m in mcpServers" :key="mcpName(m)" class="mcp-card">
                  <div class="tool-card__head">
                    <div class="tool-card__avatar mcp">
                      <SvgIcon icon="mdi:server-network" />
                    </div>
                    <NTag size="small" round :bordered="false" class="tag-category">{{ mcpToolCount(m) }} 个工具</NTag>
                  </div>
                  <div class="tool-card__name" :title="mcpName(m)">{{ mcpName(m) }}</div>
                  <div class="tool-card__desc" :title="mcpDesc(m)">
                    {{ mcpDesc(m) || '暂无描述' }}
                  </div>
                  <div class="mcp-card__foot">
                    <span class="mcp-card__status">
                      <span class="dot" />
                      已连接
                    </span>
                    <NButton size="tiny" quaternary type="error" class="mcp-card__delete" @click="handleDeleteMcp(m)">
                      <template #icon>
                        <SvgIcon icon="mdi:delete-outline" />
                      </template>
                      删除
                    </NButton>
                  </div>
                </div>
              </div>
            </template>
          </NTabPane>
        </NTabs>
      </div>
    </div>

    <!-- 添加 MCP 服务弹窗 -->
    <NModal
      v-model:show="mcpModalVisible"
      preset="dialog"
      title="添加 MCP 服务"
      positive-text="添加"
      negative-text="取消"
      :positive-button-props="{ loading: mcpSaving }"
      @positive-click="handleCreateMcp"
    >
      <div class="mcp-modal">
        <NForm :model="mcpForm" size="small" label-placement="top">
          <NFormItem label="服务名称" path="name">
            <NInput v-model:value="mcpForm.name" placeholder="如 内部天气服务" />
          </NFormItem>
          <NFormItem label="服务器地址" path="server_url">
            <NInput
              v-model:value="mcpForm.server_url"
              placeholder="https://mcp.example.com/sse 或 streamable-http 地址"
            />
          </NFormItem>
          <NFormItem label="请求头（可选，每行一组 Key: Value）" path="headers">
            <NInput
              v-model:value="mcpForm.headers"
              type="textarea"
              :rows="3"
              placeholder="Authorization: Bearer xxx&#10;x-custom: 1"
            />
          </NFormItem>
        </NForm>
        <p class="mcp-modal__hint">新增后系统会立即尝试连接该地址并拉取工具列表</p>
      </div>
    </NModal>
  </div>
</template>

<style scoped lang="scss">
.agent-config {
  display: grid;
  grid-template-columns: 248px minmax(0, 1fr);
  height: 100%;
  gap: 12px;
}
.agent-config__sidebar {
  min-width: 0;
  overflow: visible;
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

.type-tag {
  margin-left: 8px;
}

/* 统计 + 工具栏 */
.tool-bar {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
  flex-wrap: wrap;

  &__stats {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  &__filters {
    display: flex;
    gap: 4px;
    padding: 3px;
    border-radius: 8px;
    background: rgba(6, 20, 38, 0.6);
    border: 1px solid rgba(25, 95, 176, 0.2);
  }

  &__search {
    width: 240px;
    margin-left: auto;
  }
}

.stat {
  font-weight: 800;
  font-size: 14px;
  color: #eaf5ff;

  &--all {
    color: #38bdf8;
  }

  &--bound {
    color: #34d399;
  }
}

.stat-label {
  font-size: 12px;
  color: rgba(203, 227, 255, 0.5);
  margin-right: 6px;
}

.filter-btn {
  appearance: none;
  border: none;
  background: transparent;
  padding: 4px 12px;
  border-radius: 6px;
  font-size: 12px;
  color: rgba(203, 227, 255, 0.6);
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    color: #eaf5ff;
  }

  &.is-on {
    background: rgba(41, 163, 255, 0.18);
    color: #29a3ff;
    box-shadow: inset 0 0 0 1px rgba(41, 163, 255, 0.35);
  }
}

/* 加载骨架 */
.tool-skeleton {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;

  &__card {
    height: 150px;
    border-radius: var(--agent-radius-sm);
    background: linear-gradient(
      100deg,
      rgba(7, 28, 52, 0.4) 40%,
      rgba(41, 163, 255, 0.08) 50%,
      rgba(7, 28, 52, 0.4) 60%
    );
    background-size: 200% 100%;
    animation: skeleton-loading 1.4s infinite;
    border: 1px solid rgba(25, 95, 176, 0.12);
  }
}

@keyframes skeleton-loading {
  to {
    background-position: -200% 0;
  }
}

/* 增强空态 */
.custom-empty {
  padding: 60px 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  text-align: center;

  &__icon {
    width: 64px;
    height: 64px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 32px;
    color: rgba(41, 163, 255, 0.35);
    border-radius: 18px;
    background: rgba(41, 163, 255, 0.06);
    border: 1px solid rgba(25, 95, 176, 0.18);
  }

  &__title {
    font-size: 15px;
    font-weight: 700;
    color: #eaf5ff;
  }

  &__desc {
    font-size: 12px;
    color: rgba(203, 227, 255, 0.5);
    max-width: 360px;
  }
}

.tool-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
}

.tool-card,
.mcp-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px;
  border: 1px solid rgba(25, 95, 176, 0.3);
  border-radius: var(--agent-radius-sm);
  background: rgba(7, 28, 52, 0.5);
  transition:
    border-color 0.2s ease,
    background 0.2s ease,
    transform 0.2s ease,
    box-shadow 0.2s ease;

  &:hover {
    border-color: rgba(61, 166, 255, 0.32);
    background: rgba(10, 32, 58, 0.6);
    box-shadow: 0 6px 20px rgba(2, 10, 22, 0.4);
    transform: translateY(-1px);
  }

  &--bound {
    border-color: rgba(52, 168, 255, 0.45);
    background: rgba(10, 32, 58, 0.7);
  }

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  &__avatar {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 38px;
    height: 38px;
    border-radius: 10px;
    font-size: 19px;
    color: rgba(203, 227, 255, 0.75);
    background: rgba(41, 163, 255, 0.12);
    border: 1px solid rgba(41, 163, 255, 0.22);

    &.is-bound {
      color: #fff;
      background: linear-gradient(135deg, #3b82f6, #60a5fa);
      border-color: transparent;
      box-shadow: 0 0 12px rgba(59, 130, 246, 0.35);
    }

    &.mcp {
      color: #34d399;
      background: rgba(52, 211, 153, 0.12);
      border-color: rgba(52, 211, 153, 0.25);
    }
  }

  &__name {
    font-size: 14px;
    font-weight: 700;
    color: #eaf5ff;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__desc {
    font-size: 12px;
    line-height: 1.5;
    color: rgba(203, 227, 255, 0.55);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    min-height: 36px;
  }

  &__tags {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
}

.tag-type,
.tag-provider,
.tag-category {
  color: rgba(203, 227, 255, 0.8);
  background: rgba(41, 163, 255, 0.12);
}

.tag-provider {
  background: rgba(139, 92, 246, 0.16);
}

.tag-category {
  background: rgba(52, 211, 153, 0.14);
}

.mcp-card__foot {
  margin-top: auto;
  padding-top: 6px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.mcp-card__delete {
  margin-left: auto;
  opacity: 0.75;
  transition: opacity 0.2s ease;

  &:hover {
    opacity: 1;
  }
}

.mcp-modal__hint {
  margin-top: 10px;
  font-size: 12px;
  color: var(--text-tertiary);
}

.mcp-card__status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: #34d399;

  .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #34d399;
    box-shadow: 0 0 8px rgba(52, 211, 153, 0.6);
  }
}
</style>
