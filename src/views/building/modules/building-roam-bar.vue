<script setup lang="ts">
import { ref } from 'vue';
import type { BuildingRoamPoint } from './types';

defineOptions({ name: 'BuildingRoamBar' });

defineProps<{ points: BuildingRoamPoint[] }>();

const emit = defineEmits<{ selectPoint: [point: BuildingRoamPoint] }>();

const expanded = ref(false);

function toggle() { expanded.value = !expanded.value; }
function handleSelect(point: BuildingRoamPoint) { emit('selectPoint', point); }
</script>

<template>
  <div class="roam-container" :class="{ 'roam--expanded': expanded }">
    <!-- 展开/收起触发条 -->
    <button type="button" class="roam-trigger" @click="toggle">
      <span class="trigger-label">
        <SvgIcon icon="mdi:map-marker-path" class="trigger-icon" />
        街景漫游
      </span>
      <span class="trigger-count">{{ points.length }}个点位</span>
      <SvgIcon :icon="expanded ? 'mdi:chevron-down' : 'mdi:chevron-up'" class="trigger-arrow" />
    </button>

    <!-- 卡片列表 -->
    <transition name="roam-slide">
      <div v-show="expanded" class="roam-panel">
        <div class="roam-scroll">
          <div
            v-for="point in points"
            :key="point.id"
            class="roam-card"
            @click="handleSelect(point)"
          >
            <div class="card-img">
              <div class="img-bg">
                <SvgIcon icon="mdi:streetview" class="img-icon" />
              </div>
              <div class="card-badge">
                <SvgIcon icon="mdi:map-marker" class="badge-icon" />
              </div>
            </div>
            <div class="card-body">
              <div class="card-title">{{ point.title }}</div>
              <div class="card-desc">{{ point.entranceInfo.split('\n')[0] }}</div>
              <div class="card-dist">距目标 {{ point.distance }}</div>
            </div>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.roam-container {
  position: absolute; left: 50%; bottom: 14px;
  transform: translateX(-50%); z-index: 24;
  display: flex; flex-direction: column; align-items: center; gap: 8px;
}

.roam-trigger {
  display: flex; align-items: center; gap: 10px;
  padding: 9px 18px; border: 1px solid rgba(255,255,255,0.08);
  border-radius: 999px; background: rgba(10,16,30,0.88);
  color: rgba(255,255,255,0.75); backdrop-filter: blur(18px);
  box-shadow: 0 8px 24px rgba(0,0,0,0.28), 0 0 0 1px rgba(255,255,255,0.03);
  cursor: pointer; font-size: 12px; font-weight: 600;
  transition: all 0.22s cubic-bezier(0.16,1,0.3,1);
  white-space: nowrap; user-select: none;
}
.roam-trigger:hover {
  border-color: rgba(59,130,246,0.4); background: rgba(15,24,42,0.92);
  color: rgba(255,255,255,0.92); box-shadow: 0 10px 30px rgba(0,0,0,0.3), 0 0 16px rgba(59,130,246,0.08);
  transform: translateY(-1px);
}
.roam--expanded .roam-trigger {
  border-color: rgba(59,130,246,0.3); background: rgba(15,24,42,0.92);
}

.trigger-label { display: flex; align-items: center; gap: 6px; }
.trigger-icon { font-size: 15px; color: #3b82f6; }
.trigger-count { font-size: 10px; color: rgba(255,255,255,0.3); font-weight: 400; }
.trigger-arrow { font-size: 16px; color: rgba(255,255,255,0.3); transition: transform 0.3s; }
.roam--expanded .trigger-arrow { transform: rotate(180deg); }

.roam-panel {
  width: min(96vw, 740px);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 16px; background: rgba(10,16,30,0.9);
  backdrop-filter: blur(22px);
  box-shadow: 0 16px 48px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.03);
  padding: 16px 18px 18px; overflow: hidden;
}

.roam-scroll {
  display: flex; gap: 12px; overflow-x: auto; padding-bottom: 4px;
  scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.08) transparent;
}
.roam-scroll::-webkit-scrollbar { height: 4px; }
.roam-scroll::-webkit-scrollbar-thumb { border-radius: 999px; background: rgba(255,255,255,0.08); }

.roam-slide-enter-active { transition: all 0.35s cubic-bezier(0.16,1,0.3,1); }
.roam-slide-leave-active { transition: all 0.22s cubic-bezier(0.16,1,0.3,1); }
.roam-slide-enter-from { opacity: 0; transform: translateY(20px) scale(0.97); }
.roam-slide-leave-to { opacity: 0; transform: translateY(12px) scale(0.98); }

.roam-card {
  flex-shrink: 0; width: 172px;
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 12px; overflow: hidden;
  background: rgba(255,255,255,0.02);
  cursor: pointer; transition: all 0.22s cubic-bezier(0.16,1,0.3,1);
}
.roam-card:hover {
  border-color: rgba(59,130,246,0.3); background: rgba(59,130,246,0.05);
  transform: translateY(-3px);
  box-shadow: 0 8px 24px rgba(0,0,0,0.25), 0 0 14px rgba(59,130,246,0.06);
}
.roam-card:active { transform: translateY(0) scale(0.97); transition: all 0.08s ease; }

.card-img { position: relative; width: 100%; height: 96px; overflow: hidden; }
.img-bg {
  width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, rgba(59,130,246,0.08), rgba(10,16,30,0.3));
}
.img-icon { font-size: 28px; color: rgba(255,255,255,0.1); }

.card-badge {
  position: absolute; top: 8px; right: 8px;
  width: 26px; height: 26px; border-radius: 50%;
  background: rgba(10,16,30,0.8); backdrop-filter: blur(8px);
  display: flex; align-items: center; justify-content: center;
  border: 1px solid rgba(59,130,246,0.3);
}
.badge-icon { font-size: 12px; color: #3b82f6; }

.card-body { padding: 11px 12px 12px; display: flex; flex-direction: column; gap: 4px; }
.card-title { font-size: 13px; font-weight: 700; color: rgba(255,255,255,0.9); }
.card-desc { font-size: 11px; color: rgba(255,255,255,0.4); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.card-dist { font-size: 10px; color: rgba(96,165,250,0.75); font-weight: 600; margin-top: 2px; }
</style>
