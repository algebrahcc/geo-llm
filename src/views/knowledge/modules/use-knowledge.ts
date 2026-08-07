import { computed, onMounted, ref, watch } from 'vue';
import { filterKnowledgeDocuments } from './real';
import type { KnowledgeDocument } from './types';
import { fetchKbDatasets, fetchKbDocuments } from '@/service/api/knowledge';
import {
  asList,
  buildDatasetCollections,
  extractPayload,
  getDatasetDocumentCount,
  getDatasetId,
  getDatasetName,
  mapKbDocToKnowledgeDocument
} from './real';

export function useKnowledge() {
  const selectedCollection = ref('all');
  const searchKeyword = ref('');
  const sourceFilter = ref('');
  const statusFilter = ref<'' | KnowledgeDocument['status']>('');

  // 当前知识库文档列表统一来自接口数据
  const realDocuments = ref<KnowledgeDocument[]>([]);
  const kbDatasets = ref<Api.Knowledge.Dataset[]>([]);
  const kbLoading = ref(false);
  const kbFailed = ref(false);

  async function loadDatasets() {
    try {
      const dsRes = await fetchKbDatasets();
      kbDatasets.value = asList<Api.Knowledge.Dataset>(extractPayload(dsRes));
      if (dsRes?.error && kbDatasets.value.length === 0) {
        kbFailed.value = true;
      }
    } catch {
      kbFailed.value = true;
      kbDatasets.value = [];
    }
  }

  async function loadRealDocuments() {
    kbLoading.value = true;
    kbFailed.value = false;
    try {
      await loadDatasets();

      let docs: Api.Knowledge.Document[] = [];

      if (selectedCollection.value === 'all') {
        const datasetIds = kbDatasets.value.map(getDatasetId).filter(Boolean);
        const responses = await Promise.all(datasetIds.map(datasetId => fetchKbDocuments({ datasetId })));
        const aggregated = responses.flatMap(res => asList<Api.Knowledge.Document>(extractPayload(res)));
        const unique = new Map<string, Api.Knowledge.Document>();
        aggregated.forEach(item => {
          const key = String(item.difyDocumentId || item.id || '');
          if (key) unique.set(key, item);
        });
        docs = Array.from(unique.values());
      } else {
        const docRes = await fetchKbDocuments({ datasetId: selectedCollection.value });
        docs = asList<Api.Knowledge.Document>(extractPayload(docRes));
        if (docRes?.error && docs.length === 0) {
          kbFailed.value = true;
        }
      }

      realDocuments.value = docs.map(item => mapKbDocToKnowledgeDocument(item, kbDatasets.value));
    } catch {
      kbFailed.value = true;
      realDocuments.value = [];
    } finally {
      kbLoading.value = false;
    }
  }

  const allDocuments = computed<KnowledgeDocument[]>(() => realDocuments.value);

  onMounted(loadRealDocuments);
  watch(selectedCollection, () => {
    loadRealDocuments();
  });
  const sortBy = ref<'recent' | 'hits' | 'chunks'>('recent');

  const docsByCollection = computed(() =>
    selectedCollection.value === 'all'
      ? allDocuments.value
      : allDocuments.value.filter(item => item.collection === selectedCollection.value)
  );

  const sourceOptions = computed(() =>
    Array.from(new Set(docsByCollection.value.map(item => item.source))).map(item => ({ label: item, value: item }))
  );

  const statusOptions = [
    { label: '全部状态', value: '' },
    { label: '可用', value: 'ready' },
    { label: '处理中', value: 'indexing' },
    { label: '草稿', value: 'draft' },
    { label: '异常', value: 'failed' }
  ];

  const sortOptions = [
    { label: '最近更新', value: 'recent' },
    { label: '命中优先', value: 'hits' },
    { label: '分块优先', value: 'chunks' }
  ];

  const collectionSummary = computed(() =>
    buildDatasetCollections(kbDatasets.value, allDocuments.value).map(item => ({
      ...item,
      count:
        item.key === 'all'
          ? kbDatasets.value.reduce((sum, dataset) => sum + getDatasetDocumentCount(dataset), 0) ||
            allDocuments.value.length
          : (() => {
              const dataset = kbDatasets.value.find(current => getDatasetId(current) === item.key);
              return dataset
                ? getDatasetDocumentCount(dataset)
                : allDocuments.value.filter(doc => doc.collection === item.key).length;
            })()
    }))
  );

  function getCollectionLabel(key: string): string {
    const ds = kbDatasets.value.find(d => getDatasetId(d) === key);
    if (ds) return getDatasetName(ds);
    return key;
  }

  const collectionGroups = computed(() => {
    const grouped = new Map<string, typeof collectionSummary.value>();

    collectionSummary.value.forEach(item => {
      const existing = grouped.get(item.group) || [];
      existing.push(item);
      grouped.set(item.group, existing);
    });

    return Array.from(grouped.entries()).map(([group, items]) => ({
      group,
      items
    }));
  });

  const filteredDocuments = computed(() =>
    filterKnowledgeDocuments(
      {
        collection: selectedCollection.value,
        search: searchKeyword.value,
        source: sourceFilter.value,
        status: statusFilter.value,
        sort: sortBy.value
      },
      allDocuments.value
    )
  );

  function resetFilters() {
    selectedCollection.value = 'all';
    searchKeyword.value = '';
    sourceFilter.value = '';
    statusFilter.value = '';
    sortBy.value = 'recent';
  }

  return {
    selectedCollection,
    searchKeyword,
    sourceFilter,
    statusFilter,
    sortBy,
    sourceOptions,
    statusOptions,
    sortOptions,
    collectionSummary,
    collectionGroups,
    getCollectionLabel,
    filteredDocuments,
    kbLoading,
    kbFailed,
    loadRealDocuments,
    resetFilters
  };
}
