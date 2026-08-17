<script setup lang="ts">
import { ref, watch, computed, reactive } from 'vue';
import { NSwitch, NEmpty, NSpin, NTag, NInputNumber, NSelect, NButton } from 'naive-ui';
import SvgIcon from '@/components/custom/svg-icon.vue';
import { fetchKbDatasets } from '@/service/api/knowledge';
import { fetchDifyAppDatasets, bindDifyAppDatasets, unbindDifyAppDataset } from '@/service/api/difyApp';

const props = defineProps<{ appId: string | number | null }>();

const loading = ref(false);
const saving = ref(false);
const available = ref<Api.Knowledge.Dataset[]>([]);
const boundIds = ref<string[]>([]);
const proxyMissing = ref(false);

/** 检索参数配置（透传到后端 dataset_configs） */
const retrievalForm = reactive({
  topK: 2,
  scoreThreshold: 0,
  retrievalModel: 'multiple'
});
const retrievalSaving = ref(false);

function datasetId(d: Api.Knowledge.Dataset) {
  return String(d.id ?? '');
}
function datasetName(d: Api.Knowledge.Dataset) {
  return String(d.name ?? '未命名知识库');
}
function docCount(d: Api.Knowledge.Dataset) {
  return Number(d.document_count ?? d.doc_count ?? 0) || 0;
}

async function load() {
  if (props.appId == null) return;
  loading.value = true;
  proxyMissing.value = false;
  try {
    const [kbRes, appRes] = await Promise.all([fetchKbDatasets(), fetchDifyAppDatasets(props.appId)]);
    // 后端 /api/kb/documents/datasets 返回分页结构 { data: [...], total, page, ... }，
    // 需解包 data.data；兼容直接返回数组的场景。
    const kbRaw = kbRes?.data as unknown;
    available.value = (Array.isArray(kbRaw) ? kbRaw : ((kbRaw as { data?: unknown })?.data ?? [])) as Api.Knowledge.Dataset[];
    const raw = appRes?.data as unknown;
    const payload = (Array.isArray(raw) ? raw : ((raw as { data?: unknown })?.data ?? [])) as Array<
      Record<string, unknown>
    >;
    boundIds.value = payload.map(item => String(item.id ?? ''));
  } catch {
    proxyMissing.value = true;
    window.$message?.warning('加载知识库绑定失败（后端可能未代理 datasets 绑定）');
  } finally {
    loading.value = false;
  }
}

watch(() => props.appId, load, { immediate: true });

const boundSet = computed(() => new Set(boundIds.value));

async function toggleBind(d: Api.Knowledge.Dataset, next: boolean) {
  if (props.appId == null) return;
  const id = datasetId(d);
  const nextIds = next ? [...new Set([...boundIds.value, id])] : boundIds.value.filter(x => x !== id);
  saving.value = true;
  try {
    if (next) {
      await bindDifyAppDatasets(
        props.appId,
        nextIds,
        nextIds.length
          ? { topK: retrievalForm.topK, scoreThreshold: retrievalForm.scoreThreshold, retrievalModel: retrievalForm.retrievalModel }
          : undefined
      );
    } else {
      await unbindDifyAppDataset(props.appId, id);
    }
    boundIds.value = nextIds;
    window.$message?.success(next ? '已绑定知识库' : '已解绑知识库');
  } catch (e) {
    const msg = (e as { message?: string })?.message;
    if (msg && /Agent|Workflow|编排|原生/i.test(msg)) {
      window.$message?.error(msg || '该应用类型不支持接口绑定知识库，请在 Dify 控制台「编排」页中配置');
    } else {
      window.$message?.error(msg || '操作失败，请确认后端已代理「应用-知识库」绑定接口');
    }
  } finally {
    saving.value = false;
  }
}

/** 保存检索参数并重新写入已绑定知识库的 dataset_configs */
async function saveRetrieval() {
  if (props.appId == null || boundIds.value.length === 0) {
    window.$message?.info('请先绑定至少一个知识库，再保存检索参数');
    return;
  }
  retrievalSaving.value = true;
  try {
    await bindDifyAppDatasets(props.appId, boundIds.value, {
      topK: retrievalForm.topK,
      scoreThreshold: retrievalForm.scoreThreshold,
      retrievalModel: retrievalForm.retrievalModel
    });
    window.$message?.success('检索参数已保存');
  } catch (e) {
    const msg = (e as { message?: string })?.message;
    window.$message?.error(msg || '保存检索参数失败');
  } finally {
    retrievalSaving.value = false;
  }
}
</script>

<template>
  <div class="ds-binding">
    <div class="section-desc">
      将地理环境知识库关联到该智能体，即可在对话中基于知识库内容做 RAG 检索增强。下方为当前系统所有知识库，开关即绑定 /
      解绑。
    </div>

    <div class="retrieval-bar">
      <div class="retrieval-field">
        <span class="retrieval-label">检索模式</span>
        <NSelect
          v-model:value="retrievalForm.retrievalModel"
          class="retrieval-select"
          :options="[
            { label: '多路召回 (multiple)', value: 'multiple' },
            { label: '单路召回 (single)', value: 'single' }
          ]"
        />
      </div>
      <div class="retrieval-field">
        <span class="retrieval-label">Top K</span>
        <NInputNumber v-model:value="retrievalForm.topK" :min="1" :max="20" class="retrieval-num" />
      </div>
      <div class="retrieval-field">
        <span class="retrieval-label">相似度阈值</span>
        <NInputNumber
          v-model:value="retrievalForm.scoreThreshold"
          :min="0"
          :max="1"
          :step="0.1"
          class="retrieval-num"
        />
      </div>
      <NButton size="small" :loading="retrievalSaving" @click="saveRetrieval">保存检索参数</NButton>
    </div>

    <NSpin :show="loading">
      <div v-if="proxyMissing" class="section-desc warn">
        后端尚未代理「应用 - 知识库」绑定接口，暂无法读写绑定关系。
      </div>

      <div v-else-if="available.length === 0" class="empty-wrap">
        <NEmpty description="暂无可关联的知识库" />
      </div>

      <ul v-else class="ds-list">
        <li v-for="d in available" :key="datasetId(d)" class="ds-item">
          <div class="ds-item__main">
            <SvgIcon icon="mdi:database-outline" class="ds-item__icon" />
            <div class="ds-item__text">
              <div class="ds-item__name">{{ datasetName(d) }}</div>
              <div class="ds-item__sub">
                <NTag size="small" round>{{ docCount(d) }} 篇文档</NTag>
                <span v-if="d.description" class="ds-item__desc">{{ d.description }}</span>
              </div>
            </div>
          </div>
          <NSwitch :value="boundSet.has(datasetId(d))" :loading="saving" @update:value="val => toggleBind(d, val)" />
        </li>
      </ul>
    </NSpin>
  </div>
</template>

<style scoped lang="scss">
.ds-binding {
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
.retrieval-bar {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  padding: 10px 12px;
  margin-bottom: 12px;
  border: 1px solid rgba(25, 95, 176, 0.35);
  border-radius: 6px;
  background: rgba(7, 28, 52, 0.4);
}
.retrieval-field {
  display: flex;
  align-items: center;
  gap: 8px;
}
.retrieval-label {
  font-size: 12px;
  color: rgba(203, 227, 255, 0.65);
}
.retrieval-select {
  width: 180px;
}
.retrieval-num {
  width: 100px;
}
.empty-wrap {
  padding: 24px 0;
  display: flex;
  justify-content: center;
}
.ds-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.ds-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid rgba(25, 95, 176, 0.35);
  border-radius: 4px;
  background: rgba(7, 28, 52, 0.5);
}
.ds-item__main {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.ds-item__icon {
  font-size: 18px;
  color: #29a3ff;
}
.ds-item__text {
  min-width: 0;
}
.ds-item__name {
  font-weight: 600;
}
.ds-item__sub {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
  font-size: 12px;
  color: rgba(203, 227, 255, 0.6);
}
.ds-item__desc {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 360px;
}
</style>
