<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useThemeStore } from '@/store/modules/theme';
import SvgIcon from '@/components/custom/svg-icon.vue';
import { getAgentByKey, getTaskById, rerunAgentTask } from '@/mock/agent';
import AgentTaskTimeline from './agent-task-timeline.vue';

defineOptions({
  name: 'AgentTaskDetailPage'
});

const route = useRoute();
const router = useRouter();
const themeStore = useThemeStore();
const darkMode = computed(() => themeStore.darkMode);

const taskId = computed(() => String(route.query.id || ''));
const detail = computed(() => getTaskById(taskId.value));
const agent = computed(() => getAgentByKey(detail.value?.agentKey));

function goBack() {
  router.push({
    name: 'agent_workbench' as never,
    query: {
      agent: detail.value?.agentKey || route.query.agent
    }
  });
}

function handleRerun() {
  if (!detail.value) return;

  const task = rerunAgentTask(detail.value.id);
  if (!task) return;

  window.$message?.success('已生成重跑任务');
  router.replace({
    name: 'agent_task_detail' as never,
    query: {
      id: task.id,
      agent: task.agentKey
    }
  });
}
</script>

<template>
  <div class="task-detail-page" :class="{ 'task-detail-page--dark': darkMode }">
    <div class="detail-shell">
      <template v-if="detail">
        <div class="panel-surface detail-hero">
          <div class="panel-head">
            <SvgIcon icon="mdi:clipboard-text-clock-outline" class="panel-head__icon" />
            <span class="panel-head__title">任务详情</span>
          </div>
          <div class="panel-body">
            <div class="flex flex-wrap items-start justify-between gap-14px">
              <div>
                <div class="flex flex-wrap items-center gap-8px">
                  <NButton quaternary @click="goBack">返回工作台</NButton>
                  <NTag size="small" round :bordered="false">{{ agent.name }}</NTag>
                  <NTag
                    size="small"
                    round
                    :type="detail.status === 'success' ? 'success' : detail.status === 'running' ? 'warning' : 'error'"
                    :bordered="false"
                  >
                    {{ detail.status === 'success' ? '已完成' : detail.status === 'running' ? '运行中' : '失败' }}
                  </NTag>
                </div>
                <div class="doc-title">{{ detail.title }}</div>
                <div class="doc-meta">{{ detail.createdAt }} · {{ detail.operator }}</div>
                <div class="doc-summary">{{ detail.summary }}</div>
              </div>
              <div class="flex gap-6px">
                <NButton secondary @click="goBack">返回</NButton>
                <NButton type="primary" @click="handleRerun">重新运行</NButton>
              </div>
            </div>
          </div>
        </div>

        <div class="grid gap-10px xl:grid-cols-[1.1fr_0.9fr]">
          <div class="panel-surface">
            <div class="panel-head">
              <SvgIcon icon="mdi:format-list-checks" class="panel-head__icon" />
              <span class="panel-head__title">执行步骤</span>
            </div>
            <div class="panel-body">
              <AgentTaskTimeline :task="detail" />
            </div>
          </div>

          <div class="flex flex-col gap-10px">
            <div class="panel-surface">
              <div class="panel-head">
                <SvgIcon icon="mdi:text-box-outline" class="panel-head__icon" />
                <span class="panel-head__title">任务输入</span>
              </div>
              <div class="panel-body">
                <div class="text-block">{{ detail.input }}</div>
              </div>
            </div>

            <div class="panel-surface">
              <div class="panel-head">
                <SvgIcon icon="mdi:text-box-check-outline" class="panel-head__icon" />
                <span class="panel-head__title">结果输出</span>
              </div>
              <div class="panel-body">
                <div class="result-text">{{ detail.result }}</div>
              </div>
            </div>

            <div class="panel-surface">
              <div class="panel-head">
                <SvgIcon icon="mdi:chart-box-outline" class="panel-head__icon" />
                <span class="panel-head__title">运行指标</span>
              </div>
              <div class="panel-body">
                <div class="grid gap-8px">
                  <div class="metric-row">
                    <span>耗时</span>
                    <span>{{ detail.metrics.duration }}</span>
                  </div>
                  <div class="metric-row">
                    <span>Tokens</span>
                    <span>{{ detail.metrics.tokens }}</span>
                  </div>
                  <div class="metric-row">
                    <span>置信度</span>
                    <span>{{ detail.metrics.confidence }}%</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="panel-surface">
              <div class="panel-head">
                <SvgIcon icon="mdi:link-variant" class="panel-head__icon" />
                <span class="panel-head__title">引用来源</span>
              </div>
              <div class="panel-body">
                <div class="flex flex-wrap gap-4px">
                  <NTag v-for="item in detail.references" :key="item" size="small" round :bordered="false">{{ item }}</NTag>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>

      <div v-else class="panel-surface">
        <div class="panel-body">
          <NEmpty description="任务不存在或已被清空">
            <template #extra>
              <NButton secondary @click="goBack">返回工作台</NButton>
            </template>
          </NEmpty>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.task-detail-page {
  --page-bg:
    radial-gradient(circle at top, rgba(0, 153, 255, 0.14) 0%, rgba(0, 0, 0, 0) 36%),
    linear-gradient(180deg, #041528 0%, #041120 38%, #03101b 100%);
  --surface-bg: linear-gradient(180deg, rgba(3, 19, 41, 0.94) 0%, rgba(2, 15, 32, 0.96) 100%);
  --surface-border: rgba(43, 131, 255, 0.28);
  --line: rgba(25, 95, 176, 0.35);
  --accent: #29a3ff;

  height: 100%;
  background: var(--page-bg);
  color: #eaf5ff;
  overflow: auto;
}

.task-detail-page--dark {
  color-scheme: dark;
}

.detail-shell {
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.panel-surface {
  background: var(--surface-bg);
  border: 1px solid var(--surface-border);
  box-shadow: 0 0 0 1px rgba(32, 111, 202, 0.22), 0 18px 40px rgba(1, 8, 18, 0.45);
  border-radius: 4px;
  position: relative;
}

.panel-surface::before,
.panel-surface::after {
  content: '';
  position: absolute;
  width: 10px;
  height: 10px;
  pointer-events: none;
  z-index: 2;
  opacity: 0.35;
}

.panel-surface::before {
  top: -1px;
  left: -1px;
  border-top: 2px solid var(--accent);
  border-left: 2px solid var(--accent);
  border-radius: 4px 0 0 0;
}

.panel-surface::after {
  bottom: -1px;
  right: -1px;
  border-bottom: 2px solid var(--accent);
  border-right: 2px solid var(--accent);
  border-radius: 0 0 4px 0;
}

.panel-head {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 46px;
  padding: 0 14px;
  border-bottom: 1px solid var(--line);
  background: linear-gradient(180deg, rgba(10, 38, 72, 0.96) 0%, rgba(5, 25, 47, 0.96) 100%);
  position: relative;
}

.panel-head::before {
  content: '';
  position: absolute;
  left: 0;
  top: 20%;
  bottom: 20%;
  width: 2px;
  border-radius: 1px;
  background: linear-gradient(180deg, transparent, var(--accent), transparent);
  opacity: 0.5;
}

.panel-head__icon {
  font-size: 16px;
  color: var(--accent);
  filter: drop-shadow(0 0 4px rgba(41, 163, 255, 0.25));
}

.panel-head__title {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.5px;
  text-shadow: 0 0 8px rgba(41, 163, 255, 0.12);
}

.panel-body {
  padding: 14px;
}

.doc-title {
  margin-top: 14px;
  font-size: 20px;
  font-weight: 700;
  color: #eaf5ff;
}

.doc-meta {
  margin-top: 6px;
  font-size: 12px;
  color: rgba(147, 196, 255, 0.5);
}

.doc-summary {
  margin-top: 12px;
  max-width: 860px;
  font-size: 13px;
  line-height: 22px;
  color: rgba(203, 227, 255, 0.65);
}

.text-block {
  font-size: 12px;
  line-height: 20px;
  color: rgba(203, 227, 255, 0.65);
}

.result-text {
  font-size: 12px;
  line-height: 20px;
  color: rgba(41, 163, 255, 0.85);
}

.metric-row {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 4px;
  background: rgba(6, 20, 38, 0.5);
  color: rgba(203, 227, 255, 0.65);
  font-size: 12px;
}

/* Scrollbar */
.task-detail-page::-webkit-scrollbar {
  width: 8px;
}

.task-detail-page::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: rgba(48, 127, 212, 0.45);
}

.task-detail-page::-webkit-scrollbar-track {
  background: transparent;
}
</style>
