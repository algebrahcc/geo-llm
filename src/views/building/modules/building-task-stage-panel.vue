<script setup lang="ts">
import type { BuildingEnvironmentItem, BuildingTask } from './types';

defineOptions({
  name: 'BuildingTaskStagePanel'
});

interface Props {
  task: BuildingTask;
  environments: BuildingEnvironmentItem[];
  collapsed: boolean;
}

defineProps<Props>();

const emit = defineEmits<{
  toggleCollapse: [];
}>();
</script>

<template>
  <NCard :bordered="false" size="small" class="task-panel" :class="[{ 'task-panel--collapsed': collapsed }]">
    <template #header>
      <div class="panel-title-wrap">
        <div class="title-group">
          <SvgIcon icon="mdi:clipboard-text-outline" class="panel-icon" />
          <span>任务模拟信息</span>
        </div>
        <NButton quaternary circle size="small" @click="emit('toggleCollapse')">
          <template #icon>
            <SvgIcon :icon="collapsed ? 'mdi:chevron-right' : 'mdi:chevron-left'" />
          </template>
        </NButton>
      </div>
    </template>

    <div v-if="!collapsed" class="panel-body">
      <!-- ════════ 任务基本信息 ════════ -->
      <div class="section">
        <div class="section-header">
          <span class="section-badge">任务</span>
          <span class="section-label-text">任务模拟信息</span>
          <span class="task-status-tag" :class="`status--${task.status === '进行中' ? 'active' : 'standby'}`">
            <span class="status-dot-inner" />{{ task.status }}
          </span>
        </div>

        <div class="info-grid">
          <div class="info-cell">
            <span class="info-k">任务名称</span>
            <span class="info-v">{{ task.title }}</span>
          </div>
          <div class="info-cell">
            <span class="info-k">任务编号</span>
            <span class="info-v mono">{{ task.code }}</span>
          </div>
          <div class="info-cell">
            <span class="info-k">任务类型</span>
            <div class="info-v-wrap">
              <span class="type-tag">楼宇夺控</span>
            </div>
          </div>
          <div class="info-cell">
            <span class="info-k">规划时间</span>
            <span class="info-v">{{ task.updatedAt }}</span>
          </div>
          <div class="info-cell">
            <span class="info-k">指挥员</span>
            <span class="info-v info-v--operator">{{ task.operator }}</span>
          </div>
          <div class="info-cell" />
          <div class="info-cell info-cell--span2">
            <span class="info-k">任务简报</span>
            <span class="info-v info-v--brief">{{ task.summary }}</span>
          </div>
        </div>
      </div>

      <!-- ════════ 环境信息 ════════ -->
      <div class="section">
        <div class="section-header">
          <span class="section-badge section-badge--env">环境</span>
          <span class="section-label-text">环境信息</span>
        </div>

        <div class="env-grid">
          <div
            v-for="env in environments"
            :key="env.id"
            class="env-item"
            :class="[env.level ? `env-item--${env.level}` : '']"
          >
            <div class="env-head">
              <SvgIcon :icon="env.icon" class="env-icon" />
              <span class="env-label">{{ env.label }}</span>
              <span v-if="env.level" class="env-risk">
                <span class="env-risk-dot" :class="[`env-risk-dot--${env.level}`]" />
              </span>
            </div>
            <div class="env-value">{{ env.value }}</div>
          </div>
        </div>
      </div>

      <!-- ════════ 快捷工具条 ════════ -->
      <div class="quick-toolbar">
        <button type="button" class="qt-btn" title="态势预检">
          <SvgIcon icon="mdi:shield-check-outline" class="qt-icon" />
          <span>态势预检</span>
        </button>
        <button type="button" class="qt-btn" title="视角控制">
          <SvgIcon icon="mdi:video-3d" class="qt-icon" />
          <span>视角控制</span>
        </button>
        <button type="button" class="qt-btn" title="距离测量">
          <SvgIcon icon="mdi:ruler" class="qt-icon" />
          <span>距离测量</span>
        </button>
        <button type="button" class="qt-btn" title="面积测量">
          <SvgIcon icon="mdi:vector-polygon" class="qt-icon" />
          <span>面积测量</span>
        </button>
        <button type="button" class="qt-btn qt-btn--danger" title="清除标绘">
          <SvgIcon icon="mdi:eraser" class="qt-icon" />
          <span>清除标绘</span>
        </button>
      </div>
    </div>
  </NCard>
</template>

<style scoped>
.task-panel {
  width: 340px;
  max-height: min(780px, calc(100vh - 130px));
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(8, 14, 26, 0.9);
  box-shadow: 0 20px 48px rgba(0, 0, 0, 0.32), inset 0 1px 0 rgba(255,255,255,0.03);
  backdrop-filter: blur(20px);
  overflow: hidden;
}
.task-panel--collapsed { width: 186px; }

.panel-title-wrap {
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  color: rgba(255, 255, 255, 0.9);
}
.title-group { display: flex; align-items: center; gap: 8px; }
.panel-icon { font-size: 17px; color: #3b82f6; }

.panel-body {
  display: flex; flex-direction: column; gap: 16px;
  max-height: min(700px, calc(100vh - 280px));
  overflow-y: auto; padding: 4px 2px 0 0; margin-right: -2px;
}

.section { border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 14px; }
.section:last-of-type { border-bottom: none; padding-bottom: 0; }

.section-header {
  display: flex; align-items: center; gap: 8px; margin-bottom: 10px;
}
.section-badge {
  font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em;
  padding: 2px 8px; border-radius: 4px;
  background: rgba(59,130,246,0.15); color: #60a5fa;
}
.section-badge--env {
  background: rgba(34,197,94,0.12); color: #4ade80;
}
.section-label-text {
  font-size: 13px; font-weight: 600; color: rgba(255,255,255,0.85); flex: 1;
}

.task-status-tag {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 10px; font-weight: 600; padding: 3px 10px; border-radius: 999px;
}
.status-dot-inner { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
.status--active {
  background: rgba(34,197,94,0.12); color: #4ade80; border: 1px solid rgba(34,197,94,0.2);
}
.status--active .status-dot-inner { background: #4ade80; box-shadow: 0 0 6px rgba(34,197,94,0.5); animation: pulse-dot 2s infinite; }
.status--standby {
  background: rgba(251,191,36,0.12); color: #fbbf24; border: 1px solid rgba(251,191,36,0.2);
}
.status--standby .status-dot-inner { background: #fbbf24; }
@keyframes pulse-dot {
  0%,100% { opacity: 1; } 50% { opacity: 0.5; }
}

.info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 10px; }
.info-cell {
  display: flex; flex-direction: column; gap: 4px;
  padding: 8px 10px; border-radius: 8px;
  background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06);
  transition: border-color 0.15s, background 0.15s;
}
.info-cell:hover { border-color: rgba(255,255,255,0.1); background: rgba(255,255,255,0.03); }
.info-cell--span2 { grid-column: span 2; }
.info-k { font-size: 10px; color: rgba(255,255,255,0.38); font-weight: 500; letter-spacing: 0.02em; text-transform: uppercase; }
.info-v { font-size: 13px; color: rgba(255,255,255,0.9); font-weight: 600; }
.info-v.mono { font-family: 'JetBrains Mono','Consolas',monospace; font-size: 11px; letter-spacing: 0.03em; color: #93c5fd; }
.info-v--operator { color: #93c5fd; }
.info-v--brief { font-size: 12px; line-height: 1.6; color: rgba(255,255,255,0.6); }
.info-v-wrap { display: flex; }
.type-tag {
  font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 4px;
  background: rgba(139,92,246,0.12); color: #a78bfa; border: 1px solid rgba(139,92,246,0.2);
}

.env-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 5px; }
.env-item {
  display: flex; flex-direction: column; gap: 4px;
  padding: 7px 10px; border-radius: 8px;
  background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05);
  transition: all 0.15s ease;
}
.env-item:hover { background: rgba(59,130,246,0.04); border-color: rgba(59,130,246,0.12); }
.env-item--high { border-left: 2px solid #fb7185; background: rgba(251,113,133,0.04); }
.env-item--medium { border-left: 2px solid #fbbf24; background: rgba(251,191,36,0.03); }
.env-item--low { border-left: 2px solid #22c55e; background: rgba(34,197,94,0.03); }
.env-head { display: flex; align-items: center; gap: 6px; }
.env-icon { font-size: 13px; color: rgba(255,255,255,0.45); }
.env-label { font-size: 11px; color: rgba(255,255,255,0.45); flex: 1; }
.env-value { font-size: 13px; font-weight: 700; color: rgba(255,255,255,0.9); padding-left: 20px; }
.env-risk-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.env-risk-dot--high { background: #fb7185; box-shadow: 0 0 6px rgba(251,113,133,0.4); }
.env-risk-dot--medium { background: #fbbf24; box-shadow: 0 0 6px rgba(251,191,36,0.3); }
.env-risk-dot--low { background: #22c55e; box-shadow: 0 0 6px rgba(34,197,94,0.3); }

.quick-toolbar {
  display: flex; flex-wrap: wrap; gap: 6px;
  padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.05);
}
.qt-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 7px 12px; border: 1px solid rgba(255,255,255,0.08);
  border-radius: 8px; background: rgba(255,255,255,0.03);
  color: rgba(255,255,255,0.65); font-size: 11px; font-weight: 500;
  cursor: pointer; transition: all 0.18s ease;
}
.qt-btn:hover {
  background: rgba(59,130,246,0.1); border-color: rgba(59,130,246,0.3);
  color: rgba(255,255,255,0.95); transform: translateY(-1px);
}
.qt-btn--danger:hover {
  background: rgba(239,68,68,0.1); border-color: rgba(239,68,68,0.3);
  color: #ef4444;
}
.qt-icon { font-size: 13px; }

.panel-body::-webkit-scrollbar { width: 4px; }
.panel-body::-webkit-scrollbar-thumb { border-radius: 999px; background: rgba(255,255,255,0.08); }
</style>
