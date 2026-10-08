<script setup lang="ts">
/**
 * 城市街景（典型场景）
 *
 * 页面本身只做装配：街景是一屏地图 +（右下角）全景浮窗的形态，
 * 面板、控制与球面逻辑都在 `modules/streetview-viewer.vue` 里，
 * 与渡河 / 规划场景的 `index.vue + modules/xxx-viewer.vue` 结构保持一致。
 */
import { useRouter } from 'vue-router';
import StreetviewViewer from './modules/streetview-viewer.vue';

defineOptions({
  name: 'StreetviewPage'
});

const router = useRouter();

/** 返回主界面（与渡河 / 规划 / 地下空间场景一致：回统计大屏） */
function handleBackToMain(): void {
  void router.push({ name: 'screen' });
}
</script>

<template>
  <div class="sv-page">
    <StreetviewViewer />

    <!-- 左上角按钮组（与渡河 / 规划场景位置与样式一致） -->
    <div class="sv-side-buttons">
      <NTooltip placement="right">
        <template #trigger>
          <button type="button" class="sv-side-btn" @click="handleBackToMain">
            <SvgIcon icon="mdi:arrow-left" />
          </button>
        </template>
        <span>返回主页</span>
      </NTooltip>
    </div>
  </div>
</template>

<style scoped>
.sv-page {
  position: relative;
  height: 100%;
  width: 100%;
  overflow: hidden;
}

/* 与 river / planning 场景的 side-btn 同一套尺寸与配色 */
.sv-side-buttons {
  position: absolute;
  top: 18px;
  left: 18px;
  z-index: 20;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sv-side-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  color: rgb(255 255 255 / 80%);
  font-size: 17px;
  cursor: pointer;
  background: rgb(12 18 30 / 92%);
  border: 1px solid rgb(255 255 255 / 10%);
  border-radius: 8px;
  transition:
    border-color 0.15s,
    background 0.15s;
}

.sv-side-btn:hover {
  background: rgb(20 30 50 / 95%);
  border-color: rgb(94 164 255 / 30%);
}
</style>
