<script setup lang="ts">
import { computed } from 'vue';
import { NTag } from 'naive-ui';
import SvgIcon from '@/components/custom/svg-icon.vue';
import { agentDefinitions, getTasksByAgentKey, type AgentKey } from '@/mock/agent';

defineProps<{
  activeKey: AgentKey;
}>();

const emit = defineEmits<{
  select: [key: AgentKey];
}>();

const runtimeMeta = {
  online: { label: '在线', type: 'success' as const },
  busy: { label: '繁忙', type: 'warning' as const },
  draft: { label: '草稿', type: 'default' as const }
};

const items = computed(() =>
  agentDefinitions.map(item => ({
    ...item,
    taskCount: getTasksByAgentKey(item.key).length
  }))
);
</script>

<template>
  <NCard :bordered="false" class="sidebar-card">
    <template #header>
      <div class="flex items-center justify-between gap-12px">
        <div>
          <div class="text-15px font-700 text-[#f8fafc]">智能体列表</div>
          <div class="mt-4px text-12px text-[#8ea3bd]">选择不同智能体查看工作台、配置和测试结果。</div>
        </div>
      </div>
    </template>

    <div class="flex flex-col gap-10px">
      <button
        v-for="item in items"
        :key="item.key"
        type="button"
        class="agent-item"
        :class="[{ 'agent-item--active': item.key === activeKey }]"
        @click="emit('select', item.key)"
      >
        <div class="flex items-start gap-12px">
          <div class="agent-icon">
            <SvgIcon :icon="item.icon" />
          </div>
          <div class="min-w-0 flex-1 text-left">
            <div class="flex items-center justify-between gap-8px">
              <div class="truncate text-14px font-600 text-[#f8fafc]">{{ item.name }}</div>
              <NTag size="small" round :type="runtimeMeta[item.status].type" :bordered="false">
                {{ runtimeMeta[item.status].label }}
              </NTag>
            </div>
            <div class="mt-6px line-clamp-2 text-12px leading-18px text-[#8ea3bd]">{{ item.slogan }}</div>
            <div class="mt-10px flex items-center justify-between text-12px text-[#7890ad]">
              <span>{{ item.model }}</span>
              <span>{{ item.taskCount }} 条任务</span>
            </div>
          </div>
        </div>
      </button>
    </div>
  </NCard>
</template>

<style scoped>
.sidebar-card {
  border-radius: 20px;
  background:
    radial-gradient(circle at top left, rgba(59, 130, 246, 0.1), transparent 28%),
    linear-gradient(180deg, rgba(15, 23, 42, 0.9), rgba(30, 41, 59, 0.82));
}

.agent-item {
  width: 100%;
  padding: 14px;
  border: 1px solid rgba(148, 163, 184, 0.12);
  border-radius: 18px;
  background: rgba(15, 23, 42, 0.4);
  transition: 180ms ease;
}

.agent-item:hover,
.agent-item--active {
  border-color: rgba(96, 165, 250, 0.38);
  background: rgba(30, 41, 59, 0.86);
}

.agent-icon {
  display: flex;
  width: 38px;
  height: 38px;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  background: rgba(59, 130, 246, 0.14);
  color: #bfdbfe;
}
</style>
