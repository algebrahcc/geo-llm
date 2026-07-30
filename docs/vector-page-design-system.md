# 矢量数据管理页面 — 设计语言文档

> 文件: `src/views/system/vector/index.vue`
> 基准参考: `src/views/catalog/index.vue` (数据目录页)

---

## 一、基调 / 氛围

| 维度         | 策略                                                             |
| ------------ | ---------------------------------------------------------------- |
| **风格**     | 深色科技风 (Dark Tech),弱发光 + 渐变描边,克制不花哨              |
| **底色**     | `#041528 → #041120 → #03101b` 三段深蓝渐变 + 顶部青色径向光晕    |
| **面板纹理** | `rgba(3,19,41,0.94) → rgba(2,15,32,0.96)` 微渐变,模拟金属/磨砂感 |
| **强调色**   | `#29a3ff` 青蓝,统一用于图标投射、按钮渐变、active 态和左侧竖条   |
| **危险色**   | `#ff6b6b`,仅删除按钮/确认弹窗/错误提示使用                       |
| **字体**     | 系统无衬线 (Microsoft YaHei / PingFang SC),等宽用 DIN / Consolas |

---

## 二、CSS 变量体系

所有变量定义在 `.vec-page` 上,作用域封闭:

```css
--vec-page-bg         页面背景 (三段径向+线性渐变)
--vec-surface-bg      卡片/面板背景 (两段线性渐变)
--vec-surface-border  面板描边 rgba(43,131,255,0.28)
--vec-line            内部分割线 rgba(25,95,176,0.35)
--vec-text-primary    主文字 #eaf5ff
--vec-text-secondary  次要文字 rgba(203,227,255,0.72)
--vec-text-tertiary   辅助文字 rgba(147,196,255,0.62)
--vec-accent          强调色 #29a3ff
--vec-danger          危险色 #ff6b6b
```

---

## 三、布局结构

```
.vec-page (flex column, gap: 10px, padding: 12px 14px)
├── .vec-toolbar (flex row, space-between)
│   ├── .vec-toolbar__left
│   │   ├── NInput (.vec-search-input, max-width: 400px, min-width: 280px)
│   │   └── NSelect (.vec-filter-select, width: 168px)
│   └── .vec-toolbar__right
│       ├── NButton (.vec-ghost-btn) — 刷新
│       └── NButton (.vec-primary-btn) — 上传数据
│
├── .vec-card (flex: 1, 四角强调线)
│   ├── .vec-card-head (左侧竖条强调)
│   │   ├── .vec-card-head__title
│   │   └── .vec-card-head__meta
│   └── .vec-table-wrap
│       ├── NDataTable (.vec-data-table)
│       └── .vec-empty (empty state)
│
└── NModal ×4 (地图 / 详情 / 编辑 / 上传)
    └── .vec-detail-card / .vec-map-card (统一卡片容器)
```

---

## 四、表格系统 (NDataTable)

### 4.1 CSS Variables Override

```css
--n-th-color: rgba(6, 29, 56, 0.94) --n-td-color: transparent --n-td-color-hover: rgba(33, 116, 212, 0.14)
  --n-border-color: rgba(25, 95, 176, 0.35) --n-th-text-color: rgba(203, 227, 255, 0.72)
  --n-td-text-color: rgba(203, 227, 255, 0.72) --n-th-font-weight: 600 --n-font-size: 13px;
```

### 4.2 单元格

| 属性            | 值                                                                 |
| --------------- | ------------------------------------------------------------------ |
| th padding      | `14px 12px`                                                        |
| td padding      | `14px 12px`                                                        |
| th 背景         | `linear-gradient(180deg, rgba(6,29,56,0.94) → rgba(4,22,43,0.94))` |
| td 底部描边     | `1px solid rgba(18,73,135,0.32)`                                   |
| row hover 背景  | `rgba(33,116,212,0.14)`                                            |
| border-collapse | `separate, border-spacing: 0`                                      |
| 字号            | `13px`                                                             |

### 4.3 列定义 (全部居中,宽度自适应)

| 列       | key            | 渲染方式                  |
| -------- | -------------- | ------------------------- |
| ID       | `id`           | 等宽字体 `row-text--mono` |
| 图层名称 | `vectorName`   | `dataset-cell__title`     |
| 类型     | `sourceType`   | `vec-type-chip` 标签      |
| 要素     | `featureCount` | 等宽字体                  |
| 状态     | `importStatus` | `vec-status-tag` 标签     |
| 创建时间 | `createTime`   | `row-text`                |
| 操作     | `actions`      | 4个圆形图标按钮           |

---

## 五、组件样式规范

### 5.1 Type Chip (类型标签)

```
display: inline-flex, align-items: center, justify-content: center
min-width: 74px, height: 24px, padding: 0 10px
border-radius: 4px, border: 1px solid transparent
font-size: 11px, line-height: 1
```

| 变体        | 背景 / 描边                                      | 文字色                 |
| ----------- | ------------------------------------------------ | ---------------------- |
| `--geojson` | `rgba(34,197,94,0.15)` / `rgba(34,197,94,0.3)`   | `rgba(74,222,128,0.9)` |
| `--default` | `rgba(150,69,18,0.22)` / `rgba(255,132,72,0.34)` | `#ffb087`              |

### 5.2 Status Tag (状态标签)

```
display: inline-flex, justify-content: center
min-width: 52px, height: 22px, padding: 0 8px
border-radius: 4px
font-size: 11px, line-height: 1, font-weight: 500
```

| 变体        | 背景 / 描边                                        | 文字色                  |
| ----------- | -------------------------------------------------- | ----------------------- |
| `--success` | `rgba(34,197,94,0.15)` / `rgba(34,197,94,0.3)`     | `rgba(74,222,128,0.9)`  |
| `--warning` | `rgba(245,158,11,0.15)` / `rgba(245,158,11,0.3)`   | `rgba(251,191,36,0.9)`  |
| `--danger`  | `rgba(255,107,107,0.15)` / `rgba(255,107,107,0.3)` | `rgba(255,141,141,0.9)` |
| `--default` | `rgba(148,163,184,0.12)` / `rgba(148,163,184,0.2)` | `rgba(203,213,225,0.7)` |

### 5.3 Action Icon Button (操作图标按钮)

```
width: 30px, height: 30px, border-radius: 50%
background: rgba(41,163,255,0.06)
border: 1px solid rgba(41,163,255,0.12)
color: rgba(203,227,255,0.65)
```

| 行为           | 效果                                                                                                          |
| -------------- | ------------------------------------------------------------------------------------------------------------- |
| hover (普通)   | `color: #fff`, `background: rgba(41,163,255,0.18)`, `translateY(-2px)`, `box-shadow: 0 4px 12px rgba(...0.2)` |
| hover (danger) | `color: #ff6b6b`, `background: rgba(255,107,107,0.15)`, 红色阴影                                              |
| tooltip        | `::after` 伪元素,居按钮上方 `bottom: calc(100% + 6px)`, 半透明深蓝背景 + 描边, hover 渐显                     |

### 5.4 Primary Button (.vec-primary-btn)

```
渐变背景: #1783f0 → #0853ab
描边: rgba(96,191,255,0.32)
border-radius: 8px, height: 38px
font-size: 13px, font-weight: 600, letter-spacing: 0.3px
box-shadow: inset 0 1px 0 rgba(181,233,255,0.14) + 0 4px 16px rgba(4,79,162,0.22)
::before 扫光动画: translateX(-100% → 100%) on hover
hover: translateY(-2px) + 阴影加深
```

### 5.5 Ghost Button (.vec-ghost-btn)

```
渐变背景: rgba(9,43,82,0.94) → rgba(5,23,46,0.96)
描边: rgba(43,118,197,0.35)
border-radius: 8px, height: 38px
font-size: 13px, letter-spacing: 0.3px
hover: translateY(-2px) + 描边变亮 + 阴影
```

---

## 六、弹窗卡片 (Modal)

### 6.1 通用卡片 (.vec-detail-card)

```
width: 680px, max-width: 92vw
border-radius: 8px
背景: linear-gradient(180deg, rgba(4,22,46,0.98) → rgba(3,16,35,0.99))
描边: rgba(43,131,255,0.32)
阴影: 三重 (描边光 + 大阴影 + 环境光)
```

### 6.2 头部 (.vec-detail-header)

```
padding: 20px 24px 16px
底部: 1px solid var(--vec-line)
背景: rgba(8,36,68,0.96) → rgba(4,22,46,0.96)
左侧: ::after 渐变竖条 (3px, transparent → accent → transparent)
```

| 元素     | 样式                                                                |
| -------- | ------------------------------------------------------------------- |
| 图标     | 28px, color: #62c4ff, drop-shadow(0 0 8px rgba(98,196,255,0.3))     |
| 标题     | 17px, font-weight: 700, text-shadow: 0 0 10px rgba(41,163,255,0.12) |
| 关闭按钮 | 32×32, grid place-items, 暗色背景 + 描边, hover 变青蓝              |

### 6.3 主体 (.vec-detail-body)

```
padding: 20px 24px 24px
overflow-y: auto
scrollbar: width 6px, thumb rgba(48,127,212,0.45), track transparent
```

### 6.4 详情网格 (.vec-detail-grid)

```
grid-template-columns: repeat(2, 1fr)
gap: 10px 24px
.field--full: grid-column 1/-1
label: 11px, color: var(--vec-text-tertiary)
value: 13px, color: var(--vec-text-primary)
value--mono: DIN/Consolas, 12px, rgba(234,245,255,0.88)
```

---

## 七、搜索栏 & 筛选

| 组件                         | 样式要点                                                                  |
| ---------------------------- | ------------------------------------------------------------------------- |
| NInput (.vec-search-input)   | 深色渐变背景,8px 圆角,38px 高度,隐藏默认 border-layer, focus 时 glow 动画 |
| NSelect (.vec-filter-select) | 168px, 38px 高度, 8px 圆角, 暗色背景, 文字色 follow text-primary/tertiary |
| 搜索图标                     | 18px, color: #7cc4f0, opacity: 0.7                                        |

---

## 八、分页栏

```css
.n-data-table__pagination {
  border-top + 渐变背景条
  min-height: 52px, padding: 8px 14px
  justify-content: flex-end
}
.n-pagination-item {
  min-width: 30px, height: 30px, border-radius: 5px, font-size: 13px
  hover: translateY(-1px)
  active: box-shadow 0 2px 10px rgba(41,163,255,0.25)
  disabled: opacity 0.45
}
```

---

## 九、地图弹窗 (.vec-map-card)

```
width: 90vw, max-width: 1400px
height: 80vh, max-height: 85vh
```

| 元素           | 样式                                                   |
| -------------- | ------------------------------------------------------ |
| 地图容器       | `flex: 1`, 背景 `#1a1f2e`, OpenLayers 缩放控件暗色主题 |
| ol-zoom button | 32×32, 暗色背景, 蓝描边                                |
| ol-attribution | 暗色半透明背景, 浅蓝文字                               |

---

## 十、状态码映射

| 后端值              | 显示文本 | 标签变体    |
| ------------------- | -------- | ----------- |
| `0` / `"IMPORTING"` | 导入中   | `--warning` |
| `1` / `"SUCCESS"`   | 已完成   | `--success` |
| `2` / `"FAILED"`    | 失败     | `--danger`  |
| 其他                | 未知     | `--default` |

---

## 十一、关键交互流程

| 操作     | 触发                       | 行为                                                               |
| -------- | -------------------------- | ------------------------------------------------------------------ |
| 刷新     | 顶栏 / 操作后              | `loadList(true)`, 重置 page=1                                      |
| 上传     | NButton → NModal           | NUpload 拖拽/选择 .geojson, 校验后缀, uploadVectorFile, 成功后刷新 |
| 查看地图 | 操作图标按钮 → NModal      | 内联 OpenLayers Map, 矢量瓦片 (MVT), 自动 fitExtent                |
| 详情     | 操作图标按钮 → NModal      | description grid 展示 VectorItem 全部字段                          |
| 编辑     | 操作图标按钮 → NModal      | NInput 编辑 vectorName, fetchVectorUpdate, 保存后刷新              |
| 删除     | 操作图标按钮 → NPopconfirm | 二次确认, fetchVectorDelete, 刷新 (带翻页边界处理)                 |
