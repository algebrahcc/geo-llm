<script setup lang="ts">
/** 场景公共右侧工具栏：2D/3D 切换 + 公共 Cesium 操作按钮 */
defineOptions({ name: 'SceneToolbar' });

export interface SceneToolbarItem {
  key: string;
  label: string;
  icon: string;
}

const props = withDefaults(
  defineProps<{
    /** 工具按钮列表 */
    items?: readonly SceneToolbarItem[];
    /** 当前激活的工具 key */
    activeKey?: string | null;
    /** 工具栏位置 */
    placement?: 'left' | 'right';
    /** 是否显示 2D/3D 切换按钮 */
    show2d3dSwitch?: boolean;
    /** 当前是否为 2D 模式 */
    is2dMode?: boolean;
  }>(),
  {
    items: () => [],
    activeKey: null,
    placement: 'right',
    show2d3dSwitch: true,
    is2dMode: false
  }
);

const emit = defineEmits<{
  select: [key: string];
  'toggle-2d3d': [];
}>();

function handleToolClick(key: string) {
  emit('select', key);
}

function handleToggle2d3d() {
  emit('toggle-2d3d');
}
</script>

<template>
  <div class="scene-toolbar" :class="[`scene-toolbar--${placement}`]">
    <!-- 2D / 3D 切换 -->
    <NTooltip v-if="show2d3dSwitch" placement="left" trigger="hover">
      <template #trigger>
        <button
          type="button"
          class="toolbar-btn toolbar-btn--view"
          :class="{ 'toolbar-btn--active': is2dMode }"
          @click="handleToggle2d3d"
        >
          <span class="view-label">{{ is2dMode ? '2D' : '3D' }}</span>
          <SvgIcon :icon="is2dMode ? 'mdi:map-outline' : 'mdi:cube-outline'" class="view-icon" />
        </button>
      </template>
      {{ is2dMode ? '当前 2D 视图' : '当前 3D 视图' }}
    </NTooltip>

    <!-- 分隔线 -->
    <div v-if="show2d3dSwitch && items.length" class="toolbar-divider" />

    <!-- 工具按钮 -->
    <template v-for="item in items" :key="item.key">
      <NTooltip placement="left" trigger="hover">
        <template #trigger>
          <button
            type="button"
            class="toolbar-btn"
            :class="{ 'toolbar-btn--active': activeKey === item.key }"
            @click="handleToolClick(item.key)"
          >
            <SvgIcon :icon="item.icon" />
          </button>
        </template>
        {{ item.label }}
      </NTooltip>
    </template>
  </div>
</template>

<style scoped>
.scene-toolbar {
  position: absolute;
  display: flex;
  flex-direction: column;
  gap: 6px;
  z-index: 20;
}

.scene-toolbar--right {
  right: 16px;
  top: 92px;
}

.scene-toolbar--left {
  left: 16px;
  top: 92px;
}

.toolbar-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  background: rgba(8, 14, 26, 0.88);
  color: rgba(255, 255, 255, 0.55);
  cursor: pointer;
  font-size: 20px;
  transition: all 0.18s ease;
  backdrop-filter: blur(10px);
  flex-shrink: 0;
}

.toolbar-btn:hover {
  background: rgba(41, 163, 255, 0.1);
  border-color: rgba(41, 163, 255, 0.3);
  color: rgba(255, 255, 255, 0.85);
}

.toolbar-btn--active {
  background: rgba(41, 163, 255, 0.14);
  border-color: #29b6ff;
  color: #29b6ff;
  box-shadow: 0 0 10px rgba(41, 163, 255, 0.15);
}

/* 2D/3D 切换按钮特殊样式 */
.toolbar-btn--view {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  font-size: 19px;
}

.view-label {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.5px;
}

.view-icon {
  font-size: 18px;
}

.toolbar-btn--view.toolbar-btn--active {
  background: rgba(46, 229, 157, 0.12);
  border-color: #2ee59d;
  color: #2ee59d;
  box-shadow: 0 0 10px rgba(46, 229, 157, 0.18);
}

.toolbar-btn--view:hover {
  background: rgba(46, 229, 157, 0.08);
  border-color: rgba(46, 229, 157, 0.3);
  color: rgba(255, 255, 255, 0.9);
}

.toolbar-divider {
  width: 28px;
  height: 1px;
  margin: 4px auto;
  background: rgba(255, 255, 255, 0.1);
}
</style>
