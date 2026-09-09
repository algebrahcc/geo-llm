# Geo-LLM 辅助决策原型系统

> 基于 Vue 3 + Vite + TypeScript + NaiveUI + UnoCSS 的地理大模型辅助决策原型系统（前端仓库）。
> 面向地理空间任务，覆盖态势感知、空间分析、方案生成与知识沉淀的完整闭环，并已对接真实后端（geo-llm-admin）与 Dify 1.16 智能体平台。

![Vue](https://img.shields.io/badge/Vue-3.5-42b883)
![Vite](https://img.shields.io/badge/Vite-8-646cff)
![TypeScript](https://img.shields.io/badge/TypeScript-6-3178c6)
![Naive UI](https://img.shields.io/badge/Naive_UI-2.44-2080f0)
![UnoCSS](https://img.shields.io/badge/UnoCSS-66-333)
![Cesium](https://img.shields.io/badge/Cesium-1.141-6CADDE)
![License](https://img.shields.io/badge/License-MIT-green)

---

## 功能模块

系统当前包含以下一级模块（按导航顺序）：

| #   | 模块               | 路径         | 说明                                                                                               |
| --- | ------------------ | ------------ | -------------------------------------------------------------------------------------------------- |
| 1   | **统计大屏**       | `/screen`    | 任务与系统态势总览：指标卡 + 网格态势 + 词云 + 任务排名 + 通知（支持全屏模式，后端按省份聚合统计） |
| 2   | **数据目录**       | `/catalog`   | 多源地理影像/数据元数据登记与文件落地：分类树、presigned URL 直传 MinIO、发布/删除/下载、分类管理  |
| 3   | **渡河工程保障**   | `/river`     | 任务输入 → 智能分析 → 多方案生成与对比 → 输出材料/标注（支持全屏模式）                             |
| 4   | **机动路线规划**   | `/planning`  | 起终点 + 约束 → 多条候选路线（用时最短 / 距离最短 / 成本最小）（支持全屏模式）                     |
| 5   | **地理环境知识库** | `/knowledge` | 知识总览、集合管理、检索测试、文档导入/详情，对接后端知识库检索                                    |
| 6   | **智能体**         | `/agent`     | 对接 Dify 1.16 的应用管理：应用列表、配置、测试对话、工具 / MCP 绑定、运行监控                     |
| 7   | **系统管理**       | `/system`    | 用户、角色、菜单、日志、在线用户管理，以及矢量数据管理（GIS 图层服务）                             |

地图类页面（渡河 / 路线 / 矢量）采用统一的"左侧面板 + 主视图 + 右侧面板"结构，跨页保持任务上下文与图层一致。

---

## 技术栈

### 核心框架

- **Vue 3.5** + **TypeScript 6** + **Vite 8**
- **Vue Router 5** + **Pinia 3**
- **Naive UI 2.44**（组件库）
- **UnoCSS 66**（原子化 CSS）

### 地理与可视化

- **Cesium 1.141** — 三维地球、BIM、漫游
- **OpenLayers 10.9** — 二维地图（管网/矢量）
- **ECharts 6** + **echarts-wordcloud** — 图表与词云

### 工具链

- **npm workspaces** monorepo（内部包 `@sa/*` 可独立发布）
- **@elegant-router/vue** — 文件路由自动生成
- **oxlint** + **oxfmt** + **ESLint** — Lint & Format
- **vue-tsc** — 类型检查
- **simple-git-hooks** — 提交信息校验

---

## 目录结构

```
geo-llm-ui/
├── build/                           # Vite 构建配置（config / plugins）
├── packages/                        # 内部 workspace 包（@sa/*）
│   ├── alova/      axios/           # HTTP 请求封装
│   ├── color/                       # 颜色工具
│   ├── hooks/                       # 通用 hooks
│   ├── materials/                   # 内置业务组件/模板
│   ├── scripts/                     # sa CLI（gen-route / release / commit / cleanup）
│   ├── uno-preset/                  # UnoCSS 预设
│   └── utils/                       # 通用工具
├── public/                          # 静态资源（影像瓦片 / 3D Tiles / 图标 / config.json）
├── docs/                            # 设计文档与 ADR（见下文「设计文档」）
├── src/
│   ├── assets/      styles/         # 静态资源与全局样式
│   ├── components/                  # 通用组件
│   ├── constants/   enum/           # 常量与枚举
│   ├── hooks/                       # 业务 hooks
│   ├── layouts/                     # 基础 / 空白布局 + 全局 UI（菜单/标签/页头）
│   ├── locales/                     # i18n
│   ├── mock/                        # 模拟数据
│   ├── plugins/                     # Vite/运行时插件
│   ├── router/                      # 路由（基于 elegant-router 自动生成）
│   ├── service/                     # 业务接口封装（api / request）
│   ├── store/                       # Pinia store
│   ├── theme/                       # 主题（亮/暗、配色 Token）
│   ├── typings/                     # 全局类型
│   ├── utils/                       # 业务工具
│   └── views/                       # 页面
│       ├── agent/     catalog/      # 智能体 / 数据目录
│       ├── knowledge/ planning/     # 知识库 / 路线规划
│       ├── river/     screen/       # 渡河保障 / 统计大屏
│       ├── system/                  # 系统管理（用户/角色/菜单/日志/在线/矢量）
│       └── _builtin/                # 内置页（403/404/500/login/iframe）
├── .env / .env.test / .env.prod     # 多环境配置
├── index.html                       # 入口（含 config.json 运行时配置加载）
├── package.json
├── uno.config.ts    vite.config.ts
└── eslint.config.js tsconfig.json
```

---

## 快速开始

### 环境要求

- **Node.js** `>= 20.19.0`

### 安装

```bash
npm install
```

### 启动开发服务器（默认 test 环境）

```bash
npm run dev
```

访问 `http://localhost:9527`。

### 构建

```bash
# 生产构建
npm run build

# 测试环境构建
npm run build:test
```

### 预览构建产物

```bash
npm run preview
```

### 启动生产环境开发模式

```bash
npm run dev:prod
```

---

## 常用脚本

| 脚本                 | 作用                       |
| -------------------- | -------------------------- |
| `npm run dev`        | 启动开发（test 环境）      |
| `npm run dev:prod`   | 启动开发（prod 环境）      |
| `npm run build`      | 生产环境构建               |
| `npm run build:test` | 测试环境构建               |
| `npm run preview`    | 预览构建产物               |
| `npm run typecheck`  | Vue + TS 类型检查          |
| `npm run lint`       | oxlint + eslint 自动修复   |
| `npm run fmt`        | oxfmt 代码格式化           |
| `npm run gen-route`  | 根据文件路由自动生成路由表 |
| `npm run cleanup`    | 清理脚本                   |
| `npm run release`    | 发布版本                   |
| `npm run commit`     | 交互式提交（中文）         |
| `npm run commit:zh`  | 交互式提交（zh-cn 文案）   |

> 项目使用 **simple-git-hooks**：pre-commit 会自动跑 `typecheck + lint + fmt`，commit-msg 会校验提交信息。

---

## 环境配置

通过 `.env` / `.env.test` / `.env.prod` 三套文件分别管理开发、测试、生产环境。常用配置项：

```bash
VITE_APP_TITLE=Geo-LLM                          # 应用标题
VITE_BASE_URL=/                                 # 部署子路径
VITE_SERVICE_BASE_URL=...                       # 后端 API 根地址（mock/真实）
VITE_SERVICE_REAL_BASE_URL=http://localhost:8000 # 真实后端服务地址（登录 & 系统管理）
VITE_ROUTER_HISTORY_MODE=history                # 路由模式
VITE_AUTH_ROUTE_MODE=static                     # 权限模式
VITE_ROUTE_HOME=screen                          # 登录后默认首页
VITE_HTTP_PROXY=Y                               # 是否启用代理
VITE_HTTP_MOCK=Y                                # 是否启用 Apifox mock（仅 dev 生效）
VITE_BUILDING_TILESET_URL=                      # 楼宇 3D Tiles 地址（可选）
VITE_GLOBE_URL=...                              # 影像/地形瓦片服务地址
```

> **运行时覆盖**：构建后可直接修改 `dist/config.json` 覆盖环境变量（见 `index.html` 中的 `__APP_CONFIG__`），无需重新打包。

### 后端对接

系统已对接真实后端服务，主要接口分组：

- **登录与系统管理** — `geo-llm-admin`（默认 `http://localhost:8000`），路径前缀 `/system/**`、`/auth/**`
- **数据目录** — `/service/catalog/**`（元数据登记、presigned URL 直传 MinIO、发布/下载/分类树）
- **知识库** — `/api/kb/**`（文档/集合/检索）
- **智能体** — `/api/dify/**`（对话、工作流、应用管理、原生 Agent 工具/知识库/日志/版本）
- **矢量数据服务** — `/system/vector/**`（GIS 矢量图层管理）

开发环境可通过 `VITE_HTTP_PROXY=Y` 由 Vite 代理转发到真实后端；也可设置 `VITE_HTTP_MOCK=Y` 使用 Apifox mock 数据（仅 dev 生效，生产环境强制关闭）。

---

## 路由与页面

路由表由 `elegant-router` 根据 `src/views` 目录自动生成（`src/router/elegant/routes.ts`）。新增页面后运行：

```bash
npm run gen-route
```

页面文件命名建议：`src/views/<module>/index.vue`，子组件放在 `src/views/<module>/modules/`。需要更多子页面结构（如知识库、智能体）时，在 `src/router/routes/index.ts` 中通过 `createXxxElegantRoute` / `createXxxVueRoute` 组合自定义路由。

---

## 内部包（@sa/\*）

通过 npm workspaces 共享，可独立发布：

- **@sa/axios** / **@sa/alova** — HTTP 请求封装（含 token 刷新、错误码处理）
- **@sa/hooks** — 通用 Vue 组合式函数
- **@sa/utils** — 纯函数工具
- **@sa/color** — 颜色转换与调色
- **@sa/materials** — 业务组件与模板
- **@sa/scripts** — `sa` 命令行（gen-route / release / commit / cleanup / update-pkg）
- **@sa/uno-preset** — UnoCSS 预设（颜色 Token / 快捷类）

---

## 设计文档

项目文档与架构决策记录集中在 [`docs/`](./docs) 目录：

- **架构与方案**：`后端架构方案.md`、`后端能力真实化开发计划.md`、`数据目录模块真实化设计基线.md`
- **智能体**：`智能体模块与Dify对齐评估.md`、`智能体与知识库功能审视与扩展建议.md`、`两Agent实现方案.md`、`影像切片上传实现手册.md`
- **矢量设计**：`vector-page-design-system.md`
- **ADR**：`docs/adr/`（架构决策记录）
- **领域术语**：`CONTEXT.md`（数据目录与 AI 智能体领域语言）

默认深色主题，字体优先系统默认（Windows 优先 `Microsoft YaHei`）。

---

## 贡献指南

1. Fork & Clone
2. 创建特性分支：`git checkout -b feat/<name>`
3. 提交：遵循 [Conventional Commits](https://www.conventionalcommits.org/)，建议使用 `npm run commit`
4. 推送 & 创建 PR
5. pre-commit 会自动跑 `typecheck + lint + fmt`，请确保通过

提交类型（参考）：

```
feat      新功能
fix       修复
refactor  重构
chore     构建/工程
docs      文档
style     样式
perf      性能
test      测试
```

---

## 许可证

[MIT](./LICENSE) © 2026 Geo-LLM
