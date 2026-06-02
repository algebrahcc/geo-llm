import { computed, ref } from 'vue';
import {
  filterKnowledgeDocuments,
  knowledgeCollections,
  knowledgeCategories,
  knowledgeDocuments,
  type KnowledgeDocument,
  type KnowledgeEditFormModel
} from '@/mock/knowledge';

export function useKnowledge() {
  const selectedCollection = ref('all');
  const selectedCategory = ref('all');
  const searchKeyword = ref('');
  const sourceFilter = ref('');
  const statusFilter = ref<'' | KnowledgeDocument['status']>('');
  const sortBy = ref<'recent' | 'hits' | 'chunks'>('recent');

  const editVisible = ref(false);
  const editingDocument = ref<KnowledgeDocument | null>(null);

  const docsByCollection = computed(() =>
    selectedCollection.value === 'all'
      ? knowledgeDocuments
      : knowledgeDocuments.filter(item => item.collection === selectedCollection.value)
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

  const categorySummary = computed(() =>
    knowledgeCategories.map(category => ({
      ...category,
      count:
        category.key === 'all'
          ? docsByCollection.value.length
          : docsByCollection.value.filter(item => item.category === category.key).length
    }))
  );

  const collectionSummary = computed(() =>
    knowledgeCollections.map(collection => ({
      ...collection,
      count:
        collection.key === 'all'
          ? knowledgeDocuments.length
          : knowledgeDocuments.filter(item => item.collection === collection.key).length
    }))
  );

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
    filterKnowledgeDocuments({
      collection: selectedCollection.value,
      category: selectedCategory.value,
      search: searchKeyword.value,
      source: sourceFilter.value,
      status: statusFilter.value,
      sort: sortBy.value
    })
  );

  function openEdit(document: KnowledgeDocument) {
    editingDocument.value = document;
    editVisible.value = true;
  }

  function closeEdit() {
    editVisible.value = false;
    editingDocument.value = null;
  }

  function resetFilters() {
    selectedCollection.value = 'all';
    selectedCategory.value = 'all';
    searchKeyword.value = '';
    sourceFilter.value = '';
    statusFilter.value = '';
    sortBy.value = 'recent';
  }

  function buildEditForm(document: KnowledgeDocument): KnowledgeEditFormModel {
    return {
      id: document.id,
      name: document.name,
      category: document.category,
      source: document.source,
      reviewer: document.reviewer,
      tags: [...document.tags],
      summary: document.summary
    };
  }

  return {
    selectedCategory,
    selectedCollection,
    searchKeyword,
    sourceFilter,
    statusFilter,
    sortBy,
    editVisible,
    editingDocument,
    sourceOptions,
    statusOptions,
    sortOptions,
    categorySummary,
    collectionSummary,
    collectionGroups,
    filteredDocuments,
    openEdit,
    closeEdit,
    resetFilters,
    buildEditForm
  };
}
