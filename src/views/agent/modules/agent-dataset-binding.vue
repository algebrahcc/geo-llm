<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { NSwitch, NEmpty, NSpin, NTag } from 'naive-ui';
import SvgIcon from '@/components/custom/svg-icon.vue';
import { fetchKbDatasets } from '@/service/api/knowledge';
import { fetchDifyAppDatasets, bindDifyAppDatasets, unbindDifyAppDataset } from '@/service/api/difyApp';

const props = defineProps<{ appId: number | null }>();

const loading = ref(false);
const saving = ref(false);
const available = ref<Api.Knowledge.Dataset[]>([]);
const boundIds = ref<string[]>([]);
const proxyMissing = ref(false);

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
    available.value = (kbRes?.data ?? []) as Api.Knowledge.Dataset[];
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
      await bindDifyAppDatasets(props.appId, nextIds);
    } else {
      await unbindDifyAppDataset(props.appId, id);
    }
    boundIds.value = nextIds;
    window.$message?.success(next ? '已绑定知识库' : '已解绑知识库');
  } catch {
    window.$message?.error('操作失败，请确认后端已代理「应用-知识库」绑定接口');
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="ds-binding">
    <div class="section-desc">
      将地理环境知识库关联到该智能体，即可在对话中基于知识库内容做 RAG 检索增强。下方为当前系统所有知识库，开关即绑定 /
      解绑。
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
