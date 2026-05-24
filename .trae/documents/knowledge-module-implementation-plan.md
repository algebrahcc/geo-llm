# 知识库模块实现计划

## Summary

基于 `ui-design.md` 中 `4.7 知识库` 的目标与结构要求，本次先完成一个“可交互、可演示、可扩展”的知识库模块前端实现，范围包括：

- 知识库主页
- 文档详情子页
- 前端 Mock 数据层
- 导入抽屉、搜索筛选、分类切换、查看/编辑/删除等交互闭环

整体风格采用“现代知识库 + 后台工作台”的折中方案：主列表页保留 Dify 类知识库的轻工作台感，详情页聚焦单文档的处理状态、元数据、摘要与 chunk 预览，不做复杂知识流编排与真实向量检索。

## Current State Analysis

### 现有页面与路由

- 当前知识库入口文件为 `src/views/knowledge/index.vue`
- 路由已自动生成并接入菜单，路径为 `/knowledge`
- 当前页面仅为占位页：顶部分类卡片 + 导入按钮 + 静态 `NDataTable`
- 页面数据、列定义、操作按钮均硬编码在单文件中，未拆分模块、未接入 mock、未做交互逻辑

### 现有可参考模式

- `src/views/catalog/index.vue` 已形成“业务页 + mock 数据”的基础模式，可复用其数据组织思路与表格操作方式
- 项目使用 `layout.base` 统一后台壳，页面内容区已有 `p-16px` 的全局内容留白
- 当前知识库页尚未利用项目内更成熟的业务拆分方式，也没有建立类型、mock、模块组件的边界

### 外部参考结论

参考 Dify 知识库相关公开文档后，可抽取出适合当前项目的现代知识库交互骨架：

- 顶部保留“知识库分类/集合”的可切换入口
- 主区聚焦文档列表与检索
- 导入并不只上传文件，还应带有文档来源、标签、处理状态等信息
- 文档详情适合展示摘要、元数据、处理状态、chunk 预览、检索配置摘要

结合用户选择，本次只采纳其信息架构与视觉方向，不复制 Dify 的完整知识编排流程。

## Assumptions & Decisions

### 已确认决策

- 实现范围：`含详情子页`
- 数据来源：`前端 Mock`
- 体验方向：`折中方案`，即主页偏现代知识库，交互不做过深流程编排
- 详情页结构：`文档详情`

### 本次明确不做

- 不接真实后端接口
- 不做真实文件上传解析、embedding、索引构建、向量检索
- 不做知识库工作流编排页
- 不做多级“知识库集合 -> 文档列表 -> chunk 编辑器”复杂信息架构
- 不做文档在线预览器（PDF/Word 渲染）

### 前端表现层决策

- 主页面采用“两段式”布局：
  - 顶部：分类卡片 + 搜索区 + 操作区
  - 主区：文档列表表格
- 详情页采用“三段式”信息布局：
  - 顶部：返回、标题、状态、主操作
  - 中部：摘要/元数据/处理信息卡片
  - 底部：chunk 列表与引用信息
- 导入采用抽屉，不单独新建路由页
- 编辑采用抽屉或 modal，避免增加额外复杂路由

## Proposed Changes

### 1. 新增知识库 mock 数据与类型模型

#### 文件

- `src/mock/knowledge.ts`

#### What

- 建立知识库分类、文档列表、文档详情、chunk 数据、状态枚举等 mock 数据

#### Why

- 当前 `knowledge/index.vue` 内部写死数据，不利于列表页与详情页共享
- 本次选择前端 Mock，需要一份足够支撑完整交互的数据源

#### How

- 设计数据结构：
  - `KnowledgeCategory`
  - `KnowledgeDocument`
  - `KnowledgeDocumentDetail`
  - `KnowledgeChunk`
  - `KnowledgeImportFormModel`
- mock 数据覆盖以下字段：
  - 文档名称、分类、来源、格式、大小、创建/更新时间、审核人
  - 标签、摘要、处理状态、索引方式、chunk 数量、命中次数、最近使用时间
  - chunk 内容、顺序、长度、关键词、状态

### 2. 重构知识库主页为工作台式页面

#### 文件

- `src/views/knowledge/index.vue`

#### What

- 将当前占位页重构为真正的知识库主页

#### Why

- 现有页面只是静态演示，无法满足“分类浏览 + 检索 + 导入 + 管理操作”的目标
- 需要形成与文档设计一致、又更接近现代知识库产品的使用体验

#### How

- 页面结构调整为：
  - 顶部分类区：知识分类卡片，支持高亮、统计、切换
  - 工具栏：搜索框、来源筛选、状态筛选、排序方式
  - 右上操作：导入、新建条目、刷新
  - 主表格：展示文档列表
- 表格列建议落地为：
  - 文档名称
  - 分类
  - 标签
  - 来源
  - 处理状态
  - 更新时间
  - 审核人
  - 操作
- 支持以下交互：
  - 分类切换过滤
  - 关键词搜索
  - 来源/状态筛选
  - 查看详情
  - 编辑元数据
  - 删除确认
- 样式方向：
  - 分类卡片采用轻量工作台风格
  - 表格与操作区更贴近 Dify/现代知识库产品，而非传统纯灰后台表格

### 3. 为知识库主页拆分模块组件

#### 文件

- `src/views/knowledge/modules/knowledge-category-card.vue`
- `src/views/knowledge/modules/knowledge-toolbar.vue`
- `src/views/knowledge/modules/knowledge-import-drawer.vue`
- `src/views/knowledge/modules/knowledge-edit-drawer.vue`

#### What

- 将主页的重要交互块拆成模块组件

#### Why

- 当前页面若继续堆在一个 `.vue` 中，后续详情页、抽屉、筛选逻辑会迅速失控
- 用户已明确要求项目按模块化方式实现，而非将逻辑塞进单文件

#### How

- `knowledge-category-card.vue`
  - 单个分类卡片展示名称、数量、说明、激活态
- `knowledge-toolbar.vue`
  - 聚合搜索、筛选、排序、主操作按钮
- `knowledge-import-drawer.vue`
  - 负责导入表单 UI 与提交事件
  - 字段包括：文件、分类、来源、标签、索引模式、备注
- `knowledge-edit-drawer.vue`
  - 负责编辑文档元数据

### 4. 增加文档详情子页

#### 文件

- `src/views/knowledge/detail.vue`

#### What

- 新增知识库文档详情页

#### Why

- 用户已明确要求“含详情子页”
- 文档设计虽然未强制要求详情页，但现代知识库产品中，单文档的元数据、处理状态、chunk 预览是重要体验部分

#### How

- 通过路由参数接收文档 id，例如 `/knowledge/detail?id=doc-001`
- 详情页结构分为：
  - 顶部头部区：返回按钮、文档标题、状态标签、主操作
  - 概览信息区：摘要、来源、分类、标签、更新时间、审核人、大小、索引方式
  - 处理信息区：chunk 数量、状态、命中次数、最近使用时间
  - chunk 列表区：显示 chunk 序号、文本摘要、关键词、长度
  - 引用信息区：展示该文档被哪些任务/知识分类引用（mock）
- 交互：
  - 返回主页
  - 编辑
  - 删除
  - 复制文档名称

### 5. 补充知识库详情路由

#### 文件

- `src/router/routes/index.ts`
- 视情况检查 `src/typings/elegant-router.d.ts`
- 视情况检查 `src/router/elegant/transform.ts`

#### What

- 为文档详情子页增加明确路由

#### Why

- 当前仓库只有 `/knowledge` 页面入口，若增加详情页，需要确保路由与类型映射完整

#### How

- 新增一个基于 `layout.base` 的详情子页路由，命名建议：
  - `knowledge-detail`
- 若 elegant-router 自动生成无法覆盖需求，则同步补齐类型映射与 transform 里的路由 map
- 保持菜单仍只显示“知识库”主入口，详情页不单独出现在侧栏中

### 6. 建立主页与详情页共享的状态与映射逻辑

#### 文件

- 方案 A：直接收敛在 `src/views/knowledge/index.vue` 与 `src/views/knowledge/detail.vue`
- 方案 B：若代码量明显上升，则新增：
  - `src/views/knowledge/modules/use-knowledge.ts`

#### What

- 封装筛选、搜索、查找详情、抽屉开关等前端状态逻辑

#### Why

- 知识库主页和详情页都会依赖同一份 mock 数据与状态映射
- 若不抽离，页面层会堆积过多 computed 和事件处理函数

#### How

- 至少沉淀以下逻辑：
  - 分类过滤
  - 搜索过滤
  - 状态标签映射
  - 文档详情查找
  - 导入/编辑抽屉开关

### 7. 统一文案与视觉层级

#### 文件

- `src/views/knowledge/index.vue`
- `src/views/knowledge/detail.vue`
- `src/views/knowledge/modules/*.vue`

#### What

- 完成知识库模块的视觉与文案统一

#### Why

- 当前页面没有任何业务样式层次，和 `ui-design.md` 的页面规范存在明显差距
- 这次目标不是机械照抄文档，而是做出更像现代知识库产品的前端体验

#### How

- 保持与项目现有深色后台风格一致
- 颜色与间距遵循 `ui-design.md` 的最小 token
- 引入适量标签、状态点、信息卡片，突出：
  - 分类
  - 文档状态
  - 更新时间
  - chunk 处理信息

## Implementation Outline

### Step 1

- 阅读并刷新以下文件上下文：
  - `src/views/knowledge/index.vue`
  - `src/router/routes/index.ts`
  - `src/router/elegant/transform.ts`
  - `src/typings/elegant-router.d.ts`
  - `src/mock/catalog.ts`

### Step 2

- 新建 `src/mock/knowledge.ts`
- 准备主页与详情页共用的 mock 数据、类型与状态映射

### Step 3

- 重构 `src/views/knowledge/index.vue`
- 新增主页所需模块组件

### Step 4

- 新增 `src/views/knowledge/detail.vue`
- 接通从主页到详情页的查看跳转

### Step 5

- 增加知识库详情路由及必要的类型同步

### Step 6

- 加入导入抽屉、编辑抽屉、删除确认等交互闭环

### Step 7

- 自检与修正样式层次、状态文案、组件边界

## Verification

- 运行 `pnpm typecheck`
- 用诊断工具检查以下文件无新增报错：
  - `src/views/knowledge/index.vue`
  - `src/views/knowledge/detail.vue`
  - `src/views/knowledge/modules/*.vue`
  - `src/mock/knowledge.ts`
  - 相关路由文件
- 手工验收以下路径：
  - 打开 `/knowledge`
  - 点击分类卡片可以过滤列表
  - 搜索与筛选生效
  - 点击“导入”可打开抽屉并完成前端态提交
  - 点击“查看”能进入详情页
  - 详情页显示摘要、元数据、处理状态、chunk 列表
  - 点击“编辑”与“删除”能完成前端演示闭环

## Acceptance Criteria

- 知识库不再是静态占位页，而是具备完整前端交互的模块
- 页面结构与 `ui-design.md` 的知识库目标一致
- 风格上明显优于传统纯表格后台，更接近现代知识库产品
- 代码按模块拆分，不将复杂逻辑堆入单文件
- 在无后端前提下，可用 mock 完整演示知识库的核心流程
