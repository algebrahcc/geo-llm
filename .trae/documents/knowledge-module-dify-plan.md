# 知识库模块实现计划

## Summary

基于 `ui-design.md` 中 `4.7 知识库` 的目标，本次先完成一个可演示、可扩展、具备现代知识库工作台气质的前端模块，而不是照搬文档草图或机械复制 Dify。实现范围明确为：

- 知识库主页
- 文档详情子页
- 前端 Mock 数据与共享类型
- 导入、编辑、删除、筛选、检索、查看的前端闭环

整体方向采用“项目现有深色后台壳 + Dify 式轻工作台信息架构”的折中方案：

- 主页突出分类切换、文档列表、检索与导入
- 详情页突出文档摘要、处理状态、分块预览与引用信息
- 不做真实上传解析、向量检索、索引构建、在线文档预览

## Current State Analysis

### 现有实现

- `src/views/knowledge/index.vue` 仍是占位页，只有静态分类卡片、导入按钮和写死表格
- `src/views/knowledge` 目录下目前只有 `index.vue`，没有详情页、模块组件或共享逻辑文件
- `src/mock` 目录已有 `catalog.ts`、`screen.ts`、`globe.ts` 等 mock 组织模式，说明当前项目倾向“业务 mock 文件集中维护”

### 路由现状

- 自动生成路由中已有 `knowledge -> /knowledge`，来源于 `src/router/elegant/routes.ts`
- 自定义路由入口在 `src/router/routes/index.ts`
- 路由路径映射与类型声明分别维护在：
  - `src/router/elegant/transform.ts`
  - `src/typings/elegant-router.d.ts`
- 视图组件映射维护在 `src/router/elegant/imports.ts`

### 已确认的技术约束

- 若新增隐藏的知识库详情页，不能只改 `src/router/routes/index.ts`
- 还需要同步保证：
  - `src/router/elegant/transform.ts` 的 `routeMap` 包含新路径
  - `src/typings/elegant-router.d.ts` 包含新 `RouteKey`
  - `src/router/elegant/imports.ts` 能解析对应 view，否则 `transform` 会因 `views[view]` 不存在而报错
- 当前菜单系统支持 `hideInMenu` 与 `activeMenu`，因此详情页可以隐藏菜单同时保持“知识库”菜单高亮

### 设计文档要求提炼

从 `ui-design.md` 的 `4.7 知识库` 章节可确认的硬需求只有以下几类：

- 顶部要有知识分类卡片
- 右侧主操作要有导入
- 主区是文件或条目表格
- 核心交互是分类过滤、导入、按关键词搜索、查看/编辑/删除

这意味着本次实现重点不在“是否逐字复刻草图”，而在于把这些要求组织成更现代、更像知识库产品的前端体验。

## Assumptions & Decisions

### 已锁定决策

- 页面范围包含详情子页
- 数据全部基于前端 Mock
- 风格参考 Dify，但只借鉴信息架构和体验，不复制其完整产品流程
- 详情页定位为“文档详情”，不是独立知识流工作台

### 本次不做

- 不接真实接口
- 不做真实文件上传与解析
- 不做 embedding、向量索引、召回测试
- 不做 PDF、Word 在线预览器
- 不做复杂多级知识库集合管理

### 本次采用的实现决策

- 列表页继续保留在 `src/views/knowledge/index.vue`
- 详情页新增为 `src/views/knowledge/detail.vue`
- 知识库共享数据与查找逻辑集中在 `src/mock/knowledge.ts`
- 页面级筛选和抽屉状态封装在 `src/views/knowledge/modules/use-knowledge.ts`
- 详情页采用独立隐藏路由：
  - 路由名：`knowledge-detail`
  - 路径：`/knowledge/detail`
  - 菜单：隐藏
  - 激活菜单：`knowledge`
- 详情页通过 query 读取 `id`，例如 `/knowledge/detail?id=doc-001`

## Proposed Changes

### 1. 新增知识库 Mock 与共享模型

#### 文件

- `src/mock/knowledge.ts`

#### 修改内容

- 新增知识库领域类型：
  - `KnowledgeCategory`
  - `KnowledgeDocumentStatus`
  - `KnowledgeDocument`
  - `KnowledgeChunk`
  - `KnowledgeDocumentDetail`
  - `KnowledgeImportFormModel`
  - `KnowledgeEditFormModel`
- 新增 mock 数据：
  - 分类卡片数据
  - 文档列表数据
  - 文档详情映射
  - chunk 列表
  - 引用任务/专题数据
- 新增纯函数：
  - `filterKnowledgeDocuments`
  - `getKnowledgeDocumentDetailById`
  - `getKnowledgeStatusMeta`

#### 原因

- 首页和详情页都需要共享同一套文档、状态、chunk 数据
- 如果继续把数据写死在页面内，后续交互会快速失控

### 2. 新增知识库页面级状态组合逻辑

#### 文件

- `src/views/knowledge/modules/use-knowledge.ts`

#### 修改内容

- 管理首页筛选状态：
  - 当前分类
  - 搜索词
  - 来源筛选
  - 状态筛选
  - 排序方式
- 管理交互状态：
  - 导入抽屉开关
  - 编辑抽屉开关
  - 当前编辑文档
- 暴露派生结果：
  - 分类统计
  - 过滤后的文档列表
  - 当前详情查询入口

#### 原因

- 用户明确希望模块化开发
- 主页若同时承载表格列、筛选状态、弹层状态和跳转逻辑，单文件会迅速膨胀

### 3. 拆分知识库主页模块组件

#### 文件

- `src/views/knowledge/modules/knowledge-category-card.vue`
- `src/views/knowledge/modules/knowledge-toolbar.vue`
- `src/views/knowledge/modules/knowledge-import-drawer.vue`
- `src/views/knowledge/modules/knowledge-edit-drawer.vue`

#### 修改内容

- `knowledge-category-card.vue`
  - 渲染单个分类卡片
  - 展示名称、数量、说明、活跃态
- `knowledge-toolbar.vue`
  - 聚合搜索框、来源筛选、状态筛选、排序选择与主操作按钮
- `knowledge-import-drawer.vue`
  - 承载导入表单 UI
  - 字段固定为：文件名、分类、来源、标签、索引方式、备注
- `knowledge-edit-drawer.vue`
  - 承载编辑元数据 UI
  - 字段固定为：名称、分类、来源、标签、审核人、摘要

#### 原因

- 首页主体交互块天然可拆，拆开后更便于后续扩展为真实接口
- 与现有 `src/views/globe/modules` 的组织方式保持一致

### 4. 重构知识库主页

#### 文件

- `src/views/knowledge/index.vue`

#### 修改内容

- 用 mock + 组合逻辑替代当前硬编码数据
- 页面结构重构为三段：
  - 顶部分组卡片区
  - 中部工具栏
  - 底部文档表格卡片
- 表格列明确为：
  - 文档名称
  - 分类
  - 标签
  - 来源
  - 处理状态
  - 更新时间
  - 审核人
  - 操作
- 操作列提供：
  - 查看详情
  - 编辑
  - 删除
- 导入按钮打开抽屉
- “查看”跳转 `knowledge-detail`
- 删除采用确认式前端演示闭环

#### 原因

- 当前页面只能展示静态内容，无法满足知识库模块核心流程
- 用户明确要求先完成知识库模块实现，而不是继续保留占位页

### 5. 新增文档详情页

#### 文件

- `src/views/knowledge/detail.vue`

#### 修改内容

- 从路由 query 读取文档 `id`
- 基于 `getKnowledgeDocumentDetailById` 获取详情
- 详情页结构固定为：
  - 头部：返回、标题、状态标签、主操作按钮
  - 概览区：摘要、分类、来源、标签、格式、大小、更新时间、审核人
  - 处理区：索引方式、chunk 数、命中次数、最近使用时间、处理记录
  - chunk 区：chunk 卡片列表
  - 引用区：被哪些任务或专题引用
- 缺失 `id` 或未找到详情时，展示空状态和返回入口

#### 原因

- “详情子页”是用户已经明确收敛后的范围
- 详情页是把知识库从表格页提升到“文档中心”的关键

### 6. 补齐知识库详情路由链路

#### 文件

- `src/router/routes/index.ts`
- `src/router/elegant/imports.ts`
- `src/router/elegant/transform.ts`
- `src/typings/elegant-router.d.ts`

#### 修改内容

- 在自定义路由中新增：
  - `knowledge-detail`
  - 路径 `/knowledge/detail`
  - 组件 `layout.base$view.knowledge-detail`
  - `hideInMenu: true`
  - `activeMenu: 'knowledge'`
- 在 `imports.ts` 中加入 `knowledge-detail -> @/views/knowledge/detail.vue`
- 在 `transform.ts` 的 `routeMap` 中加入 `knowledge-detail`
- 在 `elegant-router.d.ts` 中补齐：
  - `RouteMap`
  - `CustomRouteKey`
  - `LastLevelRouteKey`
  - 相关联合类型

#### 原因

- 这条链路任何一个点漏改，都会出现类型错误或运行时找不到 view

### 7. 视觉与文案统一

#### 文件

- `src/views/knowledge/index.vue`
- `src/views/knowledge/detail.vue`
- `src/views/knowledge/modules/*.vue`

#### 修改内容

- 保持与现有后台一致的深色语义
- 强化知识库感而不是传统灰表格感：
  - 分类卡片有数量和描述
  - 状态使用标签或状态点
  - 关键信息卡片化展示
  - chunk 区采用列表卡片而非纯表格
- 文案统一围绕：
  - 文档
  - 分类
  - 来源
  - 索引
  - 分块
  - 引用

#### 原因

- 用户明确表示不要完全照文档文字实现，而是参考主流知识库前端
- 视觉层级是这次体验升级的重要部分

## Implementation Outline

### Step 1

- 新建 `src/mock/knowledge.ts`
- 先把类型、状态映射、列表数据、详情数据和过滤函数一次性建好

### Step 2

- 新建 `src/views/knowledge/modules/use-knowledge.ts`
- 让首页的筛选与抽屉状态从页面中剥离

### Step 3

- 新建四个主页模块组件：
  - `knowledge-category-card.vue`
  - `knowledge-toolbar.vue`
  - `knowledge-import-drawer.vue`
  - `knowledge-edit-drawer.vue`

### Step 4

- 重写 `src/views/knowledge/index.vue`
- 接通分类过滤、搜索、筛选、导入、编辑、删除和详情跳转

### Step 5

- 新建 `src/views/knowledge/detail.vue`
- 接通 query 取值、详情渲染和空状态处理

### Step 6

- 更新知识库详情页路由链路：
  - `src/router/routes/index.ts`
  - `src/router/elegant/imports.ts`
  - `src/router/elegant/transform.ts`
  - `src/typings/elegant-router.d.ts`

### Step 7

- 统一样式与文案
- 补充空状态、无搜索结果状态和未找到详情状态

### Step 8

- 进行类型检查与诊断修复

## Verification

### 静态验证

- 运行 `pnpm typecheck`
- 使用诊断工具检查新增或修改文件没有新增报错

### 交互验收

- 访问 `/knowledge`，看到分类卡片、工具栏和文档表格
- 点击分类卡片后，列表按分类过滤
- 输入关键词后，列表按名称、标签、来源过滤
- 切换来源和状态筛选后，列表同步变化
- 点击“导入”可打开抽屉并完成前端态提交
- 点击“编辑”可打开抽屉并回填当前文档信息
- 点击“删除”可完成前端演示闭环
- 点击“查看”后跳转 `/knowledge/detail?id=...`
- 详情页能显示摘要、元数据、状态、chunk 和引用信息
- 直接访问不存在的 `id` 时，有明确空状态反馈

## Acceptance Criteria

- `src/views/knowledge/index.vue` 不再是占位页
- 知识库模块具备分类浏览、检索、导入、编辑、删除、查看详情的前端闭环
- 新增文档详情子页，且路由隐藏不污染菜单
- 代码按模块拆分，不把主要逻辑堆进一个文件
- 整体体验明显更接近现代知识库产品，而不是传统纯表格后台
