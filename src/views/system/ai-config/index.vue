<script setup lang="ts">
import { computed, h, onMounted, reactive, ref } from 'vue';
import {
  NAlert,
  NButton,
  NDataTable,
  NDescriptions,
  NDescriptionsItem,
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NModal,
  NPopconfirm,
  NSelect,
  NSpace,
  NSwitch,
  NTabPane,
  NTabs,
  NTag,
  type DataTableColumns
} from 'naive-ui';
import SvgIcon from '@/components/custom/svg-icon.vue';
import {
  fetchAiConfigOverview,
  importAiAppFromDify,
  testAiAppConfig,
  testAiDatasetConfig
} from '@/service/api/aiConfig';
import {
  fetchDifyAppCreate,
  fetchDifyAppDelete,
  fetchDifyAppDetail,
  fetchDifyAppList,
  fetchDifyAppUpdate
} from '@/service/api/difyApp';
import {
  createKbDatasetConfig,
  deleteKbDatasetConfig,
  fetchKbDatasetConfigDetail,
  fetchKbDatasetConfigList,
  fetchRemoteKbDatasets,
  updateKbDatasetConfig
} from '@/service/api/kbDatasetConfig';

defineOptions({ name: 'AiConfigManage' });

type TabKey = 'apps' | 'datasets';

interface AppFormModel {
  id?: number;
  name: string;
  type: Api.DifyApp.AppType;
  apiKey: string;
  hasApiKey: boolean;
  clearApiKey: boolean;
  baseUrl: string;
  clearBaseUrl: boolean;
  description: string;
  sort: number;
  status: Api.DifyApp.AppStatus;
}

interface DatasetFormModel {
  id?: number;
  name: string;
  difyDatasetId: string;
  apiKey: string;
  hasApiKey: boolean;
  clearApiKey: boolean;
  baseUrl: string;
  clearBaseUrl: boolean;
  description: string;
  sort: number;
  status: Api.KbDatasetConfig.Status;
}

interface ImportAppFormModel {
  apiKey: string;
  baseUrl: string;
  sort: number;
  status: Api.DifyApp.AppStatus;
}

const activeTab = ref<TabKey>('apps');
const loading = ref(false);
const appSaving = ref(false);
const datasetSaving = ref(false);
const appTesting = ref(false);
const datasetTesting = ref(false);
const appRows = ref<Api.DifyApp.DifyAppResp[]>([]);
const datasetRows = ref<Api.KbDatasetConfig.Item[]>([]);
const remoteDatasetOptions = ref<Api.KbDatasetConfig.DifyDatasetOption[]>([]);
const overview = ref<Api.AiConfig.Overview | null>(null);

const appModalVisible = ref(false);
const datasetModalVisible = ref(false);
const importAppModalVisible = ref(false);
const importAppModalTitle = ref('从 Dify 导入应用');
const appModalTitle = ref('新增应用配置');
const datasetModalTitle = ref('新增知识集合配置');
const appImporting = ref(false);

const appTypeOptions = [
  { label: '聊天应用', value: 1 },
  { label: 'Agent 应用', value: 2 },
  { label: '工作流应用', value: 3 }
];

const statusOptions = [
  { label: '启用', value: 1 },
  { label: '禁用', value: 2 }
];

const appForm = reactive<AppFormModel>({
  name: '',
  type: 1,
  apiKey: '',
  hasApiKey: false,
  clearApiKey: false,
  baseUrl: '',
  clearBaseUrl: false,
  description: '',
  sort: 100,
  status: 1
});

const datasetForm = reactive<DatasetFormModel>({
  name: '',
  difyDatasetId: '',
  apiKey: '',
  hasApiKey: false,
  clearApiKey: false,
  baseUrl: '',
  clearBaseUrl: false,
  description: '',
  sort: 100,
  status: 1
});

const importAppForm = reactive<ImportAppFormModel>({
  apiKey: '',
  baseUrl: '',
  sort: 100,
  status: 1
});

const remoteSelectOptions = computed(() =>
  remoteDatasetOptions.value.map(item => ({
    label: `${item.name}${item.documentCount ? ` (${item.documentCount} 篇文档)` : ''}`,
    value: item.id
  }))
);

function resetAppForm() {
  Object.assign(appForm, {
    id: undefined,
    name: '',
    type: 1,
    apiKey: '',
    hasApiKey: false,
    clearApiKey: false,
    baseUrl: '',
    clearBaseUrl: false,
    description: '',
    sort: 100,
    status: 1
  });
}

function resetDatasetForm() {
  Object.assign(datasetForm, {
    id: undefined,
    name: '',
    difyDatasetId: '',
    apiKey: '',
    hasApiKey: false,
    clearApiKey: false,
    baseUrl: '',
    clearBaseUrl: false,
    description: '',
    sort: 100,
    status: 1
  });
}

function resetImportAppForm() {
  Object.assign(importAppForm, {
    apiKey: '',
    baseUrl: '',
    sort: 100,
    status: 1
  });
}

function appTypeLabel(type: Api.DifyApp.AppType) {
  return appTypeOptions.find(item => item.value === type)?.label || '未分类';
}

function statusTag(status: number) {
  return h(
    NTag,
    {
      size: 'small',
      bordered: false,
      type: status === 1 ? 'success' : 'default'
    },
    { default: () => (status === 1 ? '启用' : '禁用') }
  );
}

function configModeTag(flag?: boolean, label = '独立配置', fallback = '全局配置') {
  return h(
    NTag,
    {
      size: 'small',
      bordered: false,
      type: flag ? 'warning' : 'default'
    },
    { default: () => (flag ? label : fallback) }
  );
}

function renderActionButtons(onEdit: () => void, onDelete: () => void, onTest?: () => void) {
  const buttons: ReturnType<typeof h>[] = [];

  if (onTest) {
    buttons.push(
      h('div', { class: 'action-icon-btn action-icon-btn--test', 'data-tooltip': '测试连通性', onClick: onTest }, [
        h(SvgIcon, { icon: 'mdi:connection' })
      ])
    );
  }

  buttons.push(
    h('div', { class: 'action-icon-btn', 'data-tooltip': '编辑', onClick: onEdit }, [
      h(SvgIcon, { icon: 'mdi:pencil-outline' })
    ])
  );

  buttons.push(
    h(
      NPopconfirm,
      { onPositiveClick: onDelete },
      {
        trigger: () =>
          h('div', { class: 'action-icon-btn action-icon-btn--danger', 'data-tooltip': '删除' }, [
            h(SvgIcon, { icon: 'mdi:trash-can-outline' })
          ]),
        default: () => '确认删除当前配置？'
      }
    )
  );

  return h('div', { class: 'action-group' }, buttons);
}

const appColumns: DataTableColumns<Api.DifyApp.DifyAppResp> = [
  {
    title: '应用',
    key: 'name',
    minWidth: 220,
    render: row =>
      h('div', { class: 'sys-cell' }, [
        h(SvgIcon, {
          icon:
            row.type === 2
              ? 'mdi:robot-outline'
              : row.type === 3
                ? 'mdi:transit-connection-variant'
                : 'mdi:chat-processing-outline',
          class: 'sys-cell__icon'
        }),
        h('div', { class: 'sys-cell__content' }, [
          h('div', { class: 'sys-cell__title' }, row.name),
          h('div', { class: 'sys-cell__sub' }, appTypeLabel(row.type))
        ])
      ])
  },
  { title: '说明', key: 'description', minWidth: 180, ellipsis: { tooltip: true } },
  { title: '地址', key: 'baseUrl', minWidth: 180, render: row => row.baseUrl || '沿用全局地址' },
  { title: 'Key', key: 'apiKey', width: 150, render: row => row.apiKey || '未单独配置' },
  {
    title: '模式',
    key: 'useGlobalApiKey',
    width: 100,
    align: 'center',
    render: row => configModeTag(!row.useGlobalApiKey, '独立 Key')
  },
  { title: '状态', key: 'status', width: 90, align: 'center', render: row => statusTag(row.status) },
  { title: '排序', key: 'sort', width: 70, align: 'center' },
  { title: '更新时间', key: 'updateTime', width: 170 },
  {
    title: '操作',
    key: 'actions',
    width: 160,
    align: 'center',
    render: row =>
      renderActionButtons(
        () => openEditApp(row.id),
        () => handleDeleteApp(row.id),
        () => handleTestAppConfig({ id: row.id })
      )
  }
];

const datasetColumns: DataTableColumns<Api.KbDatasetConfig.Item> = [
  {
    title: '知识集合',
    key: 'name',
    minWidth: 220,
    render: row =>
      h('div', { class: 'sys-cell' }, [
        h(SvgIcon, { icon: 'mdi:database-outline', class: 'sys-cell__icon' }),
        h('div', { class: 'sys-cell__content' }, [
          h('div', { class: 'sys-cell__title' }, row.name),
          h('div', { class: 'sys-cell__sub' }, row.difyDatasetId || '创建时自动生成')
        ])
      ])
  },
  { title: '说明', key: 'description', minWidth: 180, ellipsis: { tooltip: true } },
  { title: '地址', key: 'baseUrl', minWidth: 180, render: row => row.baseUrl || '沿用全局地址' },
  { title: 'Key', key: 'apiKey', width: 150, render: row => row.apiKey || '未单独配置' },
  {
    title: '模式',
    key: 'useGlobalApiKey',
    width: 100,
    align: 'center',
    render: row => configModeTag(!row.useGlobalApiKey, '独立 Key')
  },
  { title: '状态', key: 'status', width: 90, align: 'center', render: row => statusTag(row.status) },
  { title: '排序', key: 'sort', width: 70, align: 'center' },
  { title: '更新时间', key: 'updateTime', width: 170 },
  {
    title: '操作',
    key: 'actions',
    width: 160,
    align: 'center',
    render: row =>
      renderActionButtons(
        () => openEditDataset(row.id),
        () => handleDeleteDataset(row.id),
        () => handleTestDatasetConfig({ id: row.id })
      )
  }
];

function normalizeRemoteDatasets(
  payload: Record<string, unknown> | null | undefined
): Api.KbDatasetConfig.DifyDatasetOption[] {
  const data = Array.isArray((payload as { data?: unknown })?.data)
    ? ((payload as { data?: unknown[] }).data as unknown[])
    : [];
  return data.map(item => {
    const current = item as Record<string, unknown>;
    return {
      id: String(current.id || ''),
      name: String(current.name || current.dataset_name || '未命名集合'),
      description: String(current.description || current.desc || ''),
      documentCount: Number(current.document_count || current.documentCount || 0)
    };
  });
}

async function loadData() {
  loading.value = true;
  try {
    const [appRes, datasetRes, overviewRes] = await Promise.all([
      fetchDifyAppList(),
      fetchKbDatasetConfigList(),
      fetchAiConfigOverview()
    ]);
    appRows.value = appRes.data || [];
    datasetRows.value = datasetRes.data || [];
    overview.value = overviewRes.data || null;
  } finally {
    loading.value = false;
  }
}

async function loadRemoteDatasets(id?: number) {
  const res = await fetchRemoteKbDatasets(id);
  remoteDatasetOptions.value = normalizeRemoteDatasets(res.data as Record<string, unknown> | undefined);
}

function openImportAppModal() {
  resetImportAppForm();
  importAppModalTitle.value = '从 Dify 导入应用';
  importAppModalVisible.value = true;
}

function openCreateApp() {
  resetAppForm();
  appModalTitle.value = '新增应用配置';
  appModalVisible.value = true;
}

async function openEditApp(id: number) {
  resetAppForm();
  appModalTitle.value = '编辑应用配置';
  const { data } = await fetchDifyAppDetail(id);
  if (data) {
    Object.assign(appForm, {
      id: data.id,
      name: data.name,
      type: data.type,
      apiKey: '',
      hasApiKey: Boolean(data.hasApiKey),
      clearApiKey: false,
      baseUrl: data.baseUrl || '',
      clearBaseUrl: false,
      description: data.description || '',
      sort: data.sort || 100,
      status: data.status
    });
    appModalVisible.value = true;
  }
}

function openCreateDataset() {
  resetDatasetForm();
  datasetModalTitle.value = '新增知识集合配置';
  datasetModalVisible.value = true;
  loadRemoteDatasets();
}

async function openEditDataset(id: number) {
  resetDatasetForm();
  datasetModalTitle.value = '编辑知识集合配置';
  const { data } = await fetchKbDatasetConfigDetail(id);
  if (data) {
    Object.assign(datasetForm, {
      id: data.id,
      name: data.name,
      difyDatasetId: data.difyDatasetId || '',
      apiKey: '',
      hasApiKey: Boolean(data.hasApiKey),
      clearApiKey: false,
      baseUrl: data.baseUrl || '',
      clearBaseUrl: false,
      description: data.description || '',
      sort: data.sort || 100,
      status: data.status
    });
    datasetModalVisible.value = true;
    loadRemoteDatasets(id);
  }
}

async function handleSubmitApp() {
  appSaving.value = true;
  try {
    const payload: Api.DifyApp.DifyAppReq = {
      name: appForm.name,
      type: appForm.type,
      apiKey: appForm.apiKey || undefined,
      clearApiKey: appForm.clearApiKey || undefined,
      baseUrl: appForm.clearBaseUrl ? undefined : appForm.baseUrl || undefined,
      clearBaseUrl: appForm.clearBaseUrl || undefined,
      description: appForm.description || undefined,
      sort: appForm.sort,
      status: appForm.status
    };
    if (appForm.id) {
      await fetchDifyAppUpdate(appForm.id, payload);
    } else {
      await fetchDifyAppCreate(payload);
    }
    window.$message?.success(appForm.id ? '应用配置已更新' : '应用配置已创建');
    appModalVisible.value = false;
    loadData();
  } catch {
    window.$message?.error('保存应用配置失败');
  } finally {
    appSaving.value = false;
  }
}

async function handleTestAppConfig(payload?: Api.AiConfig.AppTestReq) {
  appTesting.value = true;
  try {
    const { data } = await testAiAppConfig(
      payload || {
        id: appForm.id,
        type: appForm.type,
        apiKey: appForm.apiKey || undefined,
        clearApiKey: appForm.clearApiKey || undefined,
        baseUrl: appForm.baseUrl || undefined,
        clearBaseUrl: appForm.clearBaseUrl || undefined
      }
    );
    if (data) {
      window.$message?.success(data.message);
    }
  } catch {
    window.$message?.error('应用配置连通性测试失败');
  } finally {
    appTesting.value = false;
  }
}

async function handleSubmitDataset() {
  datasetSaving.value = true;
  try {
    const payload: Api.KbDatasetConfig.Req = {
      name: datasetForm.name,
      difyDatasetId: datasetForm.difyDatasetId || undefined,
      apiKey: datasetForm.apiKey || undefined,
      clearApiKey: datasetForm.clearApiKey || undefined,
      baseUrl: datasetForm.clearBaseUrl ? undefined : datasetForm.baseUrl || undefined,
      clearBaseUrl: datasetForm.clearBaseUrl || undefined,
      description: datasetForm.description || undefined,
      sort: datasetForm.sort,
      status: datasetForm.status
    };
    if (datasetForm.id) {
      await updateKbDatasetConfig(datasetForm.id, payload);
    } else {
      await createKbDatasetConfig(payload);
    }
    window.$message?.success(datasetForm.id ? '知识集合配置已更新' : '知识集合配置已创建');
    datasetModalVisible.value = false;
    loadData();
  } catch {
    window.$message?.error('保存知识集合配置失败');
  } finally {
    datasetSaving.value = false;
  }
}

async function handleTestDatasetConfig(payload?: Api.AiConfig.DatasetTestReq) {
  datasetTesting.value = true;
  try {
    const { data } = await testAiDatasetConfig(
      payload || {
        id: datasetForm.id,
        apiKey: datasetForm.apiKey || undefined,
        clearApiKey: datasetForm.clearApiKey || undefined,
        baseUrl: datasetForm.baseUrl || undefined,
        clearBaseUrl: datasetForm.clearBaseUrl || undefined
      }
    );
    if (data) {
      window.$message?.success(data.message);
    }
  } catch {
    window.$message?.error('知识集合配置连通性测试失败');
  } finally {
    datasetTesting.value = false;
  }
}

async function handleDeleteApp(id: number) {
  const { error } = await fetchDifyAppDelete([id]);
  if (!error) {
    window.$message?.success('应用配置已删除');
    loadData();
  }
}

async function handleDeleteDataset(id: number) {
  const { error } = await deleteKbDatasetConfig([id]);
  if (!error) {
    window.$message?.success('知识集合配置已删除');
    loadData();
  }
}

async function handleImportAppFromDify() {
  appImporting.value = true;
  try {
    const { data } = await importAiAppFromDify({
      apiKey: importAppForm.apiKey,
      baseUrl: importAppForm.baseUrl || undefined,
      sort: importAppForm.sort,
      status: importAppForm.status
    });
    if (data) {
      window.$message?.success(data.message);
    }
    importAppModalVisible.value = false;
    await loadData();
  } catch {
    window.$message?.error('从 Dify 导入应用失败');
  } finally {
    appImporting.value = false;
  }
}

function handleRemoteDatasetSelect(value: string | null) {
  const option = remoteDatasetOptions.value.find(item => item.id === value);
  if (!option) return;
  datasetForm.difyDatasetId = option.id;
  if (!datasetForm.name) datasetForm.name = option.name;
  if (!datasetForm.description) datasetForm.description = option.description || '';
}

onMounted(() => {
  loadData();
});
</script>

<template>
  <div class="sys-page">
    <section class="sys-search-card">
      <div>
        <div class="sys-search-title">AI 配置中心</div>
        <div class="sys-search-sub">
          统一管理 Chat、Agent、Workflow 与知识集合的连接配置，支持沿用全局配置或单独覆盖。
        </div>
      </div>
      <div class="sys-search-actions">
        <NButton secondary @click="loadData">
          <template #icon>
            <SvgIcon icon="mdi:refresh" />
          </template>
          刷新
        </NButton>
      </div>
    </section>

    <section class="sys-card">
      <NAlert type="info" :show-icon="false" class="mb-16px">
        未填写 API Key 或服务地址时，将回落到后端全局配置；如需从独立配置切回全局，可在编辑时勾选“改用全局配置”。
      </NAlert>

      <div class="overview-grid">
        <div class="overview-card">
          <div class="overview-card__title">全局连接地址</div>
          <div class="overview-card__value">{{ overview?.difyUrl || '--' }}</div>
          <div class="overview-card__desc">所有未单独指定服务地址的应用和知识集合都会回落到这里。</div>
        </div>
        <div class="overview-card">
          <div class="overview-card__title">全局 Key 状态</div>
          <NDescriptions :column="1" label-placement="left" size="small">
            <NDescriptionsItem label="聊天 / Agent">
              <div class="overview-key-row">
                <span>{{ overview?.chatApiKeyDisplay || '未配置' }}</span>
                <NTag size="small" :bordered="false" :type="overview?.chatApiKeyEnabled ? 'success' : 'default'">
                  {{ overview?.chatApiKeyEnabled ? '已启用' : '未配置' }}
                </NTag>
              </div>
            </NDescriptionsItem>
            <NDescriptionsItem label="工作流">
              <div class="overview-key-row">
                <span>{{ overview?.workflowApiKeyDisplay || '未配置' }}</span>
                <NTag size="small" :bordered="false" :type="overview?.workflowApiKeyEnabled ? 'success' : 'default'">
                  {{ overview?.workflowApiKeyEnabled ? '已启用' : '未配置' }}
                </NTag>
              </div>
            </NDescriptionsItem>
            <NDescriptionsItem label="知识库">
              <div class="overview-key-row">
                <span>{{ overview?.datasetApiKeyDisplay || '未配置' }}</span>
                <NTag size="small" :bordered="false" :type="overview?.datasetApiKeyEnabled ? 'success' : 'default'">
                  {{ overview?.datasetApiKeyEnabled ? '已启用' : '未配置' }}
                </NTag>
              </div>
            </NDescriptionsItem>
          </NDescriptions>
        </div>
        <div class="overview-card">
          <div class="overview-card__title">Dify 导入方式</div>
          <div class="overview-card__value">通过应用 API Key 识别应用</div>
          <div class="overview-card__desc">
            在 AI 配置页填写 Dify 应用 API Key 和服务地址后，系统会直接调用 Dify
            原生应用接口，自动识别应用名称、类型与说明，并同步到本地配置。
          </div>
        </div>
      </div>

      <NTabs v-model:value="activeTab" type="line" animated>
        <NTabPane name="apps" tab="应用配置">
          <div class="mb-12px flex items-center justify-between">
            <div class="section-meta">
              管理聊天应用、Agent 应用与工作流应用的连接参数。
              <span class="section-meta__highlight">支持通过应用 API Key 直接从 Dify 导入。</span>
            </div>
            <div class="flex items-center gap-8px">
              <NButton secondary @click="openImportAppModal">
                <template #icon>
                  <SvgIcon icon="mdi:database-import-outline" />
                </template>
                从 Dify 导入
              </NButton>
              <NButton type="primary" @click="openCreateApp">
                <template #icon>
                  <SvgIcon icon="mdi:plus" />
                </template>
                新增应用
              </NButton>
            </div>
          </div>
          <NAlert type="info" :show-icon="false" class="mb-12px">
            若已在 Dify 中创建应用，可直接通过应用 API Key 导入，无需依赖额外的管理态令牌。
          </NAlert>
          <NDataTable class="sys-table" :columns="appColumns" :data="appRows" :loading="loading" :bordered="false" />
        </NTabPane>

        <NTabPane name="datasets" tab="知识集合配置">
          <div class="mb-12px flex items-center justify-between">
            <div class="section-meta">管理知识集合的 Dify 数据集映射、独立 Key 与服务地址。</div>
            <NButton type="primary" @click="openCreateDataset">
              <template #icon>
                <SvgIcon icon="mdi:plus" />
              </template>
              新增知识集合
            </NButton>
          </div>
          <NDataTable
            class="sys-table"
            :columns="datasetColumns"
            :data="datasetRows"
            :loading="loading"
            :bordered="false"
          />
        </NTabPane>
      </NTabs>
    </section>

    <NModal v-model:show="appModalVisible" preset="card" class="config-modal" :title="appModalTitle">
      <NForm label-placement="top" :show-feedback="false">
        <div class="grid gap-12px md:grid-cols-2">
          <NFormItem label="应用名称">
            <NInput v-model:value="appForm.name" placeholder="例如：地理环境问答" />
          </NFormItem>
          <NFormItem label="应用类型">
            <NSelect v-model:value="appForm.type" :options="appTypeOptions" />
          </NFormItem>
          <NFormItem label="服务地址">
            <NInput v-model:value="appForm.baseUrl" :disabled="appForm.clearBaseUrl" placeholder="留空则沿用全局地址" />
          </NFormItem>
          <NFormItem label="排序">
            <NInputNumber v-model:value="appForm.sort" :min="0" :max="999" class="w-full" />
          </NFormItem>
        </div>

        <NFormItem label="应用说明">
          <NInput v-model:value="appForm.description" type="textarea" :autosize="{ minRows: 3, maxRows: 6 }" />
        </NFormItem>

        <div class="grid gap-12px md:grid-cols-2">
          <NFormItem label="API Key">
            <NInput
              v-model:value="appForm.apiKey"
              type="password"
              show-password-on="mousedown"
              :disabled="appForm.clearApiKey"
              :placeholder="appForm.hasApiKey ? '留空则保留当前凭据，填写后替换' : '留空则沿用全局 Key'"
            />
          </NFormItem>
          <NFormItem label="状态">
            <NSelect v-model:value="appForm.status" :options="statusOptions" />
          </NFormItem>
        </div>

        <NSpace class="mt-4px" vertical>
          <NSwitch :value="appForm.clearApiKey" @update:value="value => (appForm.clearApiKey = Boolean(value))">
            <template #checked>改用全局 Key</template>
            <template #unchecked>保留独立 Key</template>
          </NSwitch>
          <NSwitch :value="appForm.clearBaseUrl" @update:value="value => (appForm.clearBaseUrl = Boolean(value))">
            <template #checked>改用全局地址</template>
            <template #unchecked>保留独立地址</template>
          </NSwitch>
        </NSpace>
      </NForm>

      <template #footer>
        <div class="flex justify-end gap-8px">
          <NButton :loading="appTesting" @click="handleTestAppConfig()">测试连通性</NButton>
          <NButton @click="appModalVisible = false">取消</NButton>
          <NButton type="primary" :loading="appSaving" @click="handleSubmitApp">保存</NButton>
        </div>
      </template>
    </NModal>

    <NModal v-model:show="datasetModalVisible" preset="card" class="config-modal" :title="datasetModalTitle">
      <NForm label-placement="top" :show-feedback="false">
        <div class="grid gap-12px md:grid-cols-2">
          <NFormItem label="知识集合名称">
            <NInput v-model:value="datasetForm.name" placeholder="例如：地形分析知识集合" />
          </NFormItem>
          <NFormItem label="Dify 数据集 ID">
            <NInput v-model:value="datasetForm.difyDatasetId" placeholder="留空时创建配置会自动在 Dify 新建数据集" />
          </NFormItem>
        </div>

        <NFormItem label="从 Dify 选择已有集合">
          <div class="flex w-full gap-8px">
            <NSelect
              class="flex-1"
              clearable
              :options="remoteSelectOptions"
              placeholder="读取已有 Dify 数据集并回填"
              @update:value="handleRemoteDatasetSelect"
            />
            <NButton secondary @click="loadRemoteDatasets(datasetForm.id)">
              <template #icon>
                <SvgIcon icon="mdi:database-sync-outline" />
              </template>
              读取
            </NButton>
          </div>
        </NFormItem>

        <div class="grid gap-12px md:grid-cols-2">
          <NFormItem label="服务地址">
            <NInput
              v-model:value="datasetForm.baseUrl"
              :disabled="datasetForm.clearBaseUrl"
              placeholder="留空则沿用全局地址"
            />
          </NFormItem>
          <NFormItem label="排序">
            <NInputNumber v-model:value="datasetForm.sort" :min="0" :max="999" class="w-full" />
          </NFormItem>
        </div>

        <NFormItem label="集合说明">
          <NInput v-model:value="datasetForm.description" type="textarea" :autosize="{ minRows: 3, maxRows: 6 }" />
        </NFormItem>

        <div class="grid gap-12px md:grid-cols-2">
          <NFormItem label="API Key">
            <NInput
              v-model:value="datasetForm.apiKey"
              type="password"
              show-password-on="mousedown"
              :disabled="datasetForm.clearApiKey"
              :placeholder="datasetForm.hasApiKey ? '留空则保留当前凭据，填写后替换' : '留空则沿用全局 Key'"
            />
          </NFormItem>
          <NFormItem label="状态">
            <NSelect v-model:value="datasetForm.status" :options="statusOptions" />
          </NFormItem>
        </div>

        <NSpace class="mt-4px" vertical>
          <NSwitch :value="datasetForm.clearApiKey" @update:value="value => (datasetForm.clearApiKey = Boolean(value))">
            <template #checked>改用全局 Key</template>
            <template #unchecked>保留独立 Key</template>
          </NSwitch>
          <NSwitch
            :value="datasetForm.clearBaseUrl"
            @update:value="value => (datasetForm.clearBaseUrl = Boolean(value))"
          >
            <template #checked>改用全局地址</template>
            <template #unchecked>保留独立地址</template>
          </NSwitch>
        </NSpace>
      </NForm>

      <template #footer>
        <div class="flex justify-end gap-8px">
          <NButton :loading="datasetTesting" @click="handleTestDatasetConfig()">测试连通性</NButton>
          <NButton @click="datasetModalVisible = false">取消</NButton>
          <NButton type="primary" :loading="datasetSaving" @click="handleSubmitDataset">保存</NButton>
        </div>
      </template>
    </NModal>

    <NModal v-model:show="importAppModalVisible" preset="card" class="config-modal" :title="importAppModalTitle">
      <NAlert type="info" :show-icon="false" class="mb-16px">
        输入 Dify 应用的 API Key 后，系统会直接调用 Dify 原生应用接口读取应用名称、类型与说明，并自动生成本地应用配置。
      </NAlert>

      <NForm label-placement="top" :show-feedback="false">
        <NFormItem label="应用 API Key">
          <NInput
            v-model:value="importAppForm.apiKey"
            type="password"
            show-password-on="mousedown"
            placeholder="请输入 Dify 应用 API Key"
          />
        </NFormItem>

        <div class="grid gap-12px md:grid-cols-2">
          <NFormItem label="服务地址">
            <NInput v-model:value="importAppForm.baseUrl" placeholder="留空则沿用全局地址" />
          </NFormItem>
          <NFormItem label="状态">
            <NSelect v-model:value="importAppForm.status" :options="statusOptions" />
          </NFormItem>
          <NFormItem label="排序">
            <NInputNumber v-model:value="importAppForm.sort" :min="0" :max="999" class="w-full" />
          </NFormItem>
        </div>
      </NForm>

      <template #footer>
        <div class="flex justify-end gap-8px">
          <NButton @click="importAppModalVisible = false">取消</NButton>
          <NButton type="primary" :loading="appImporting" @click="handleImportAppFromDify">导入应用</NButton>
        </div>
      </template>
    </NModal>
  </div>
</template>

<style scoped lang="scss">
.sys-page {
  --sys-surface: linear-gradient(180deg, rgba(3, 19, 41, 0.94) 0%, rgba(2, 15, 32, 0.96) 100%);
  --sys-border: rgba(43, 131, 255, 0.28);
  --sys-line: rgba(25, 95, 176, 0.35);
  --sys-text: #eaf5ff;
  --sys-text2: rgba(203, 227, 255, 0.72);
  --sys-text3: rgba(147, 196, 255, 0.62);
  --sys-accent: #29a3ff;
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-height: 100%;
  padding: 12px 14px;
  box-sizing: border-box;
  background:
    radial-gradient(circle at top, rgba(0, 153, 255, 0.14) 0%, transparent 36%),
    linear-gradient(180deg, #041528 0%, #041120 38%, #03101b 100%);
  color: var(--sys-text);
  overflow: hidden;
}

.sys-search-card,
.sys-card {
  border-radius: 10px;
  background: var(--sys-surface);
  border: 1px solid var(--sys-border);
  box-shadow:
    0 0 0 1px rgba(32, 111, 202, 0.22),
    0 18px 40px rgba(1, 8, 18, 0.45);
  padding: 18px;
}

.sys-search-card {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
}

.sys-search-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--sys-text);
}

.sys-search-sub,
.section-meta {
  margin-top: 6px;
  color: var(--sys-text3);
  font-size: 13px;
}

.section-meta__highlight {
  margin-left: 6px;
  color: var(--sys-accent);
}

.overview-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.overview-card {
  border-radius: 12px;
  border: 1px solid var(--sys-border);
  background: rgba(41, 163, 255, 0.06);
  padding: 14px 16px;
}

.overview-card__title {
  font-size: 13px;
  color: var(--sys-text3);
}

.overview-card__value {
  margin-top: 8px;
  font-size: 16px;
  font-weight: 600;
  color: var(--sys-text);
  word-break: break-all;
}

.overview-card__desc {
  margin-top: 8px;
  font-size: 12px;
  color: var(--sys-text3);
}

.overview-key-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
}

.sys-search-actions {
  display: flex;
  gap: 8px;
}

.sys-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}

.sys-cell__icon {
  font-size: 18px;
  color: var(--sys-accent);
}

.sys-cell__content {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.sys-cell__title {
  font-weight: 600;
  color: var(--sys-text);
}

.sys-cell__sub {
  color: var(--sys-text3);
  font-size: 12px;
  word-break: break-all;
}

.action-group {
  display: flex;
  justify-content: center;
  gap: 8px;
}

.sys-action-btn {
  position: relative;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: 1px solid rgba(41, 163, 255, 0.12);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(41, 163, 255, 0.06);
  color: rgba(203, 227, 255, 0.65);
  cursor: pointer;
  transition: all 0.25s ease;
  font-family: inherit;
  outline: none;
  font-size: 16px;
  &:hover {
    color: #fff;
    background: rgba(41, 163, 255, 0.18);
    border-color: rgba(41, 163, 255, 0.35);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(41, 163, 255, 0.2);
  }

  // Tooltip above button
  &::after {
    content: attr(data-tooltip);
    position: absolute;
    bottom: calc(100% + 6px);
    left: 50%;
    transform: translateX(-50%) translateY(4px);
    padding: 3px 8px;
    border-radius: 4px;
    background: rgba(6, 29, 56, 0.95);
    border: 1px solid rgba(41, 163, 255, 0.25);
    color: rgba(203, 227, 255, 0.9);
    font-size: 11px;
    white-space: nowrap;
    pointer-events: none;
    opacity: 0;
    transition:
      opacity 0.2s ease,
      transform 0.2s ease;
    z-index: 10;
  }
  &:hover::after {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}

.sys-action-btn--danger {
  border-color: rgba(255, 107, 107, 0.12);
  background: rgba(255, 107, 107, 0.05);
  color: rgba(255, 141, 141, 0.7);
  &:hover {
    color: #ff6b6b;
    background: rgba(255, 107, 107, 0.15);
    border-color: rgba(255, 107, 107, 0.35);
    box-shadow: 0 4px 12px rgba(255, 107, 107, 0.18);
  }
}

.sys-action-btn--test {
  border-color: rgba(16, 185, 129, 0.18);
  background: rgba(16, 185, 129, 0.06);
  color: #10b981;
  &:hover {
    color: #34d399;
    background: rgba(16, 185, 129, 0.18);
    border-color: rgba(16, 185, 129, 0.4);
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.2);
  }
}

.config-modal {
  width: min(860px, calc(100vw - 32px));
}

// Table dark theme
.sys-table {
  --n-th-color: rgba(6, 29, 56, 0.94) !important;
  --n-td-color: transparent !important;
  --n-td-color-hover: rgba(33, 116, 212, 0.14) !important;
  --n-border-color: rgba(25, 95, 176, 0.35) !important;
  --n-th-text-color: rgba(203, 227, 255, 0.72) !important;
  --n-td-text-color: rgba(203, 227, 255, 0.72) !important;
  --n-th-font-weight: 600 !important;
  --n-font-size: 13px !important;
}
.sys-table :deep(.n-data-table-th) {
  background: linear-gradient(180deg, rgba(6, 29, 56, 0.94) 0%, rgba(4, 22, 43, 0.94) 100%) !important;
  font-size: 13px;
  padding: 14px 12px;
}
.sys-table :deep(.n-data-table-td) {
  padding: 14px 12px;
  border-bottom: 1px solid rgba(18, 73, 135, 0.32) !important;
}
.sys-table :deep(.n-data-table-table) {
  border-collapse: separate;
  border-spacing: 0;
}
// Scrollbar
.sys-table :deep(.n-data-table-base-table-body::-webkit-scrollbar) {
  width: 8px;
}
.sys-table :deep(.n-data-table-base-table-body::-webkit-scrollbar-thumb) {
  border-radius: 999px;
  background: rgba(76, 169, 255, 0.35);
}
.sys-table :deep(.n-data-table-base-table-body::-webkit-scrollbar-track) {
  background: transparent;
}
// NTag inside table cells
.sys-table :deep(.n-tag) {
  --n-border-radius: 4px;
  --n-font-size: 11px;
  border: none;
}
.sys-table :deep(.n-data-table-tr:hover .n-data-table-td) {
  background: rgba(33, 116, 212, 0.14) !important;
}
// Action buttons inside table — scoped via sys-table
.sys-table :deep(.action-group) {
  display: flex;
  align-items: center;
  gap: 6px;
  justify-content: center;
}
.sys-table :deep(.action-icon-btn) {
  position: relative;
  width: 30px;
  height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgba(41, 163, 255, 0.06);
  border: 1px solid rgba(41, 163, 255, 0.12);
  color: rgba(203, 227, 255, 0.65);
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  font-family: inherit;
  outline: none;
  font-size: 16px;
}
.sys-table :deep(.action-icon-btn:hover) {
  color: #fff;
  background: rgba(41, 163, 255, 0.18);
  border-color: rgba(41, 163, 255, 0.35);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(41, 163, 255, 0.2);
}
.sys-table :deep(.action-icon-btn::after) {
  content: attr(data-tooltip);
  position: absolute;
  bottom: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%) translateY(4px);
  padding: 3px 8px;
  border-radius: 4px;
  background: rgba(6, 29, 56, 0.95);
  border: 1px solid rgba(41, 163, 255, 0.25);
  color: rgba(203, 227, 255, 0.9);
  font-size: 11px;
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
  z-index: 10;
}
.sys-table :deep(.action-icon-btn:hover::after) {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}
.sys-table :deep(.action-icon-btn--danger) {
  background: rgba(255, 107, 107, 0.05);
  border-color: rgba(255, 107, 107, 0.12);
  color: rgba(255, 141, 141, 0.7);
}
.sys-table :deep(.action-icon-btn--danger:hover) {
  color: #ff6b6b;
  background: rgba(255, 107, 107, 0.15);
  border-color: rgba(255, 107, 107, 0.35);
  box-shadow: 0 4px 12px rgba(255, 107, 107, 0.18);
}
.sys-table :deep(.action-icon-btn--test) {
  border-color: rgba(16, 185, 129, 0.18);
  background: rgba(16, 185, 129, 0.06);
  color: #10b981;
}
.sys-table :deep(.action-icon-btn--test:hover) {
  color: #34d399;
  background: rgba(16, 185, 129, 0.18);
  border-color: rgba(16, 185, 129, 0.4);
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.2);
}
.sys-table :deep(.n-pagination) {
  --n-item-text-color: rgba(203, 227, 255, 0.78);
  --n-item-text-color-hover: #fff;
  --n-item-text-color-active: #fff;
  --n-item-color-active: linear-gradient(180deg, rgba(23, 115, 230, 0.72) 0%, rgba(10, 72, 148, 0.72) 100%);
  --n-item-border-active: 1px solid rgba(92, 184, 255, 0.55);
  --n-item-color: rgba(8, 28, 56, 0.85);
  --n-item-border: 1px solid rgba(48, 115, 190, 0.36);
  --n-item-border-hover: 1px solid rgba(76, 169, 255, 0.5);
  --n-item-color-hover: rgba(14, 42, 88, 0.92);
  --n-item-border-radius: 5px;
  font-size: 13px;
}
.sys-table :deep(.n-pagination-item) {
  min-width: 30px;
  height: 30px;
  border-radius: 5px;
  font-size: 13px;
  transition: all 0.2s;
}
.sys-table :deep(.n-pagination-item:hover) {
  border-color: rgba(76, 169, 255, 0.5);
  color: #fff;
  transform: translateY(-1px);
  background: rgba(14, 42, 88, 0.92);
}
.sys-table :deep(.n-pagination-item--active) {
  box-shadow: 0 2px 10px rgba(41, 163, 255, 0.25);
  font-weight: 600;
}
.sys-table :deep(.n-pagination-item--disabled) {
  opacity: 0.45;
}
.sys-table :deep(.n-pagination .n-pagination-quick-jumper) {
  color: var(--sys-text2);
  font-size: 13px;
}
.sys-table :deep(.n-pagination .n-pagination-quick-jumper .n-input) {
  --n-height: 30px;
  --n-border-radius: 5px;
}
.sys-table :deep(.n-pagination-ellipsis) {
  color: rgba(203, 227, 255, 0.5);
  font-size: 13px;
}

// Primary button dark
.sys-search-card :deep(.n-button--primary-type) {
  --n-color: linear-gradient(180deg, rgba(23, 131, 240, 0.96) 0%, rgba(8, 83, 171, 0.96) 100%);
  --n-color-hover: linear-gradient(180deg, rgba(43, 151, 255, 0.98) 0%, rgba(13, 93, 186, 0.98) 100%);
  --n-text-color: #e9f5ff;
  --n-text-color-hover: #fff;
  --n-border: 1px solid rgba(96, 191, 255, 0.32);
  --n-border-hover: 1px solid rgba(96, 191, 255, 0.5);
  --n-border-radius: 8px;
  --n-font-size: 13px;
  --n-height: 36px;
  font-weight: 600;
}

:deep(.n-modal-mask) {
  background: rgba(2, 8, 18, 0.62);
  backdrop-filter: blur(2px);
}
:deep(.n-card) {
  --n-color: linear-gradient(180deg, rgba(4, 22, 46, 0.98) 0%, rgba(3, 16, 35, 0.99) 100%) !important;
  --n-border-color: rgba(43, 131, 255, 0.32) !important;
  --n-text-color: #eaf5ff !important;
  --n-title-text-color: #eaf5ff !important;
  --n-close-color: rgba(203, 227, 255, 0.72) !important;
  --n-close-color-hover: #29a3ff !important;
  --n-border-radius: 8px !important;
  overflow: hidden;
  box-shadow:
    0 0 0 1px rgba(32, 111, 202, 0.18),
    0 24px 64px rgba(1, 6, 16, 0.7),
    0 0 80px rgba(41, 163, 255, 0.06) !important;
}
:deep(.n-card-header) {
  padding: 20px 24px 16px !important;
  border-bottom: 1px solid rgba(25, 95, 176, 0.35);
  background: linear-gradient(180deg, rgba(8, 36, 68, 0.96) 0%, rgba(4, 22, 46, 0.96) 100%);
  position: relative;
}
:deep(.n-card-header::after) {
  content: '';
  position: absolute;
  left: 0;
  top: 16%;
  bottom: 16%;
  width: 3px;
  border-radius: 2px;
  background: linear-gradient(180deg, transparent, #29a3ff, transparent);
  opacity: 0.6;
}
:deep(.n-card-header__main) {
  font-size: 17px;
  font-weight: 700;
  letter-spacing: 0.3px;
  text-shadow: 0 0 10px rgba(41, 163, 255, 0.12);
}
:deep(.n-card-header__close) {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  border: 1px solid rgba(45, 111, 183, 0.28);
  background: rgba(6, 25, 50, 0.6);
  display: grid;
  place-items: center;
}
:deep(.n-card-header__close:hover) {
  border-color: rgba(70, 176, 255, 0.4);
  background: rgba(41, 163, 255, 0.08);
}
:deep(.n-card__content) {
  padding: 20px 24px 24px;
}
:deep(.n-card__content::-webkit-scrollbar) {
  width: 6px;
}
:deep(.n-card__content::-webkit-scrollbar-thumb) {
  border-radius: 999px;
  background: rgba(48, 127, 212, 0.45);
}
:deep(.n-card__content::-webkit-scrollbar-track) {
  background: transparent;
}
// Form inside modal
:deep(.n-card .n-input) {
  --n-border: 1px solid rgba(43, 118, 197, 0.38);
  --n-border-hover: 1px solid rgba(58, 160, 255, 0.5);
  --n-border-focus: 1px solid rgba(58, 160, 255, 0.65);
  --n-color: rgba(2, 16, 31, 0.98);
  --n-text-color: #eaf5ff;
  --n-placeholder-color: rgba(132, 177, 233, 0.45);
}
:deep(.n-card .n-input__border),
:deep(.n-card .n-input__state-border) {
  display: none;
}
:deep(.n-card .n-base-selection) {
  --n-border: 1px solid rgba(43, 118, 197, 0.38);
  --n-color: rgba(2, 16, 31, 0.98);
}
:deep(.n-card .n-base-selection-label) {
  color: #eaf5ff;
}
:deep(.n-card .n-form-item-label) {
  color: rgba(203, 227, 255, 0.72);
}
:deep(.n-card .n-switch) {
  --n-rail-color: rgba(43, 118, 197, 0.38);
}
// Modal footer buttons
:deep(.n-card .n-button--primary-type) {
  --n-color: linear-gradient(180deg, rgba(23, 131, 240, 0.96) 0%, rgba(8, 83, 171, 0.96) 100%);
  --n-color-hover: linear-gradient(180deg, rgba(43, 151, 255, 0.98) 0%, rgba(13, 93, 186, 0.98) 100%);
  --n-text-color: #e9f5ff;
  --n-text-color-hover: #fff;
  --n-border: 1px solid rgba(96, 191, 255, 0.32);
  --n-border-hover: 1px solid rgba(96, 191, 255, 0.5);
  --n-border-radius: 8px;
  --n-font-size: 13px;
  --n-height: 36px;
  font-weight: 600;
}
:deep(.n-card .n-button--default-type) {
  --n-color: none;
  background: linear-gradient(180deg, rgba(9, 43, 82, 0.94) 0%, rgba(5, 23, 46, 0.96) 100%);
  --n-text-color: rgba(203, 227, 255, 0.85);
  --n-text-color-hover: #e9f5ff;
  --n-border: 1px solid rgba(43, 118, 197, 0.35);
  --n-border-hover: 1px solid rgba(58, 160, 255, 0.5);
  --n-border-radius: 8px;
  --n-font-size: 13px;
  --n-height: 36px;
}
// NAlert inside modal
:deep(.n-card .n-alert) {
  --n-color: rgba(41, 163, 255, 0.08);
  --n-border: 1px solid rgba(41, 163, 255, 0.16);
  --n-text-color: rgba(203, 227, 255, 0.85);
}
.sys-table :deep(.n-data-table__pagination) {
  border-top: 1px solid rgba(25, 95, 176, 0.35);
  background: linear-gradient(180deg, rgba(4, 21, 41, 0.98) 0%, rgba(4, 18, 34, 0.98) 100%);
  min-height: 52px;
  padding: 8px 14px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
}
.sys-table :deep(.n-pagination-item--disabled) {
  opacity: 0.45;
}
.sys-search-card :deep(.n-button--default-type),
.sys-search-card :deep(.n-button--warning-type) {
  --n-color: linear-gradient(180deg, rgba(9, 43, 82, 0.94) 0%, rgba(5, 23, 46, 0.96) 100%);
  --n-color-hover: linear-gradient(180deg, rgba(14, 53, 102, 0.96) 0%, rgba(8, 33, 66, 0.96) 100%);
  --n-text-color: rgba(203, 227, 255, 0.85);
  --n-text-color-hover: #e9f5ff;
  --n-border: 1px solid rgba(43, 118, 197, 0.35);
  --n-border-hover: 1px solid rgba(58, 160, 255, 0.5);
  --n-border-radius: 8px;
  --n-font-size: 13px;
  --n-height: 36px;
}
.sys-card :deep(.n-tabs) {
  --n-color-segment: rgba(6, 29, 56, 0.94);
  --n-tab-text-color: rgba(203, 227, 255, 0.72);
}

@media (max-width: 960px) {
  .overview-grid {
    grid-template-columns: 1fr;
  }
}
</style>
