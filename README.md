# Geo-LLM 辅助决策原型系统

> 基于 Vue 3 + Vite + TypeScript + NaiveUI + UnoCSS 的**地理大模型辅助决策原型系统**。
> 原型系统，目标是先跑通"大屏 / Web 球 / 数据目录 / 楼宇夺控 / 渡河保障 / 机动路线规划 / 知识库 / AI Agent"全链路的可视化与交互骨架。

![Vue](https://img.shields.io/badge/Vue-3.5-42b883)
![Vite](https://img.shields.io/badge/Vite-8-646cff)
![TypeScript](https://img.shields.io/badge/TypeScript-6-3178c6)
![Naive UI](https://img.shields.io/badge/Naive_UI-2.44-2080f0)
![UnoCSS](https://img.shields.io/badge/UnoCSS-66-333)
![Cesium](https://img.shields.io/badge/Cesium-1.141-6CADDE)
![License](https://img.shields.io/badge/License-MIT-green)

---

## ✨ 项目简介

Geo-LLM 是一个面向"**地理空间任务**"的辅助决策原型，覆盖从态势感知、空间分析到方案生成与知识沉淀的完整闭环。系统采用"**表现优先、能力弱化**"的实现策略：

| 能力 | 实现方式 |
| --- | --- |
| 三维地球浏览 | 真实（Cesium） |
| 相机视角/飞行/标注 | 真实（Cesium） |
| 空间分析 | 模拟（预置数据 + 流程动画） |
| 数据结果 | 预置数据驱动 |
| AI 能力 | 流程模拟 |

---

## 🧩 功能模块

系统由 8 个一级模块组成，按导航顺序如下：

| # | 模块 | 路径 | 说明 |
| --- | --- | --- | --- |
| 1 | **统计大屏** | `/screen` | 任务与系统态势总览：指标卡 + 网格态势 + 词云 + 任务排名 + 通知 |
| 2 | **Web 球** | `/globe` | 独立三维地球浏览与基础空间交互（默认菜单隐藏） |
| 3 | **数据目录** | `/catalog` | 多源地理数据的浏览、检索、入库、权限、发布管理 |
| 4 | **楼宇夺控** | `/building` | 三维地图 + BIM + 任务信息融合，支持预设路径漫游与材料生成 |
| 5 | **渡河保障方案** | `/river` | 任务输入 → 智能分析 → 多方案生成与对比 → 输出材料/标注 |
| 6 | **机动路线规划** | `/planning` | 起终点 + 约束 → 多条候选路线（用时最短 / 距离最短 / 成本最小） |
| 7 | **地理环境知识库** | `/knowledge` | 知识分类导航 + 文档导入/检索/编辑/集合管理 |
| 8 | **AI Agent** | `/agent` | 智能体选择 + 流程编排 + 调用日志 + 测试/配置 |

每个地图类页面（Web 球 / 楼宇 / 渡河 / 路线）采用统一的"**左侧面板 + 主视图 + 右侧面板**"三栏结构，跨页保持任务上下文与图层一致。

---

## 🛠️ 技术栈

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
- **pnpm workspace** monorepo
- **Elegant Router** — 文件路由自动生成
- **oxlint** + **oxfmt** + **ESLint** — Lint & Format
- **vue-tsc** — 类型检查
- **simple-git-hooks** — 提交信息校验

---

## 📁 目录结构

```
soybean-admin/
├── packages/                       # 内部 workspace 包（@sa/*）
│   ├── alova/      axios/          # HTTP 请求封装
│   ├── color/                       # 颜色工具
│   ├── hooks/                       # 通用 hooks
│   ├── materials/                   # 内置业务组件/模板
│   ├── scripts/                     # sa CLI（gen-route / release / commit）
│   ├── uno-preset/                  # UnoCSS 预设
│   └── utils/                       # 通用工具
├── public/                          # 静态资源（3D Tiles / 离线瓦片 / 图标）
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
│   ├── service/                     # 业务接口封装
│   ├── store/                       # Pinia store
│   ├── theme/                       # 主题（亮/暗、配色 Token）
│   ├── typings/                     # 全局类型
│   ├── utils/                       # 业务工具
│   └── views/                       # 页面
│       ├── agent/      building/    # AI Agent / 楼宇夺控
│       ├── catalog/    globe/       # 数据目录 / Web 球
│       ├── home/       knowledge/   # 首页 / 知识库
│       ├── planning/   river/       # 路线规划 / 渡河保障
│       ├── screen/                   # 统计大屏
│       └── _builtin/                 # 内置页（403/404/500/login/iframe）
├── scripts/                         # 项目脚本
├── ui-design.md                     # 界面设计文档（草图/规范）
├── web.md                           # Web 球模块设计说明
├── pnpm-workspace.yaml
├── uno.config.ts      vite.config.ts
├── eslint.config.js   tsconfig.json
└── .env / .env.test / .env.prod     # 多环境配置
```

---

## 🚀 快速开始

### 环境要求

- **Node.js** `>= 20.19.0`
- **pnpm** `>= 10.5.0`

### 安装

```bash
pnpm install
```

### 启动开发服务器（默认 test 环境）

```bash
pnpm dev
```

访问 `http://localhost:5173`。

### 构建

```bash
# 生产构建
pnpm build

# 测试环境构建
pnpm build:test
```

### 预览构建产物

```bash
pnpm preview
```

### 启动生产环境开发模式

```bash
pnpm dev:prod
```

---

## 📜 常用脚本

| 脚本 | 作用 |
| --- | --- |
| `pnpm dev` | 启动开发（test 环境） |
| `pnpm dev:prod` | 启动开发（prod 环境） |
| `pnpm build` | 生产环境构建 |
| `pnpm build:test` | 测试环境构建 |
| `pnpm preview` | 预览构建产物 |
| `pnpm typecheck` | Vue + TS 类型检查 |
| `pnpm lint` | oxlint + eslint 自动修复 |
| `pnpm fmt` | oxfmt 代码格式化 |
| `pnpm gen-route` | 根据文件路由自动生成路由表 |
| `pnpm cleanup` | 清理脚本 |
| `pnpm release` | 发布版本 |
| `pnpm commit` | 交互式提交（中文） |
| `pnpm commit:zh` | 交互式提交（zh-cn 文案） |

> 项目使用 **simple-git-hooks**：pre-commit 会自动跑 `typecheck + lint + fmt`，commit-msg 会校验提交信息。

---

## ⚙️ 环境配置

通过 `.env` / `.env.test` / `.env.prod` 三套文件分别管理开发、测试、生产环境。常用配置项：

```bash
VITE_APP_TITLE=Geo-LLM                          # 应用标题
VITE_BASE_URL=/                                 # 部署子路径
VITE_SERVICE_BASE_URL=...                       # 后端 API 根地址
VITE_ROUTER_HISTORY_MODE=history                # 路由模式
VITE_AUTH_ROUTE_MODE=static                     # 权限模式
VITE_ROUTE_HOME=screen                          # 登录后默认首页
VITE_HTTP_PROXY=Y                               # 是否启用代理
VITE_BUILDING_TILESET_URL=                      # 楼宇 3D Tiles 地址（可选）
```

> **运行时覆盖**：构建后可通过 `dist/config.json` 覆盖环境变量（见 `index.html` 中的 `__APP_CONFIG__`），无需重新打包。

---

## 🗺️ 路由与页面

路由表由 `elegant-router` 根据 `src/views` 目录自动生成（`src/router/elegant/routes.ts`）。新增页面后运行：

```bash
pnpm gen-route
```

页面文件命名建议：`src/views/<module>/index.vue`，子组件放在 `src/views/<module>/modules/`。

---

## 🧱 内部包（@sa/*）

通过 pnpm workspace 共享，可独立发布：

- **@sa/axios** / **@sa/alova** — HTTP 请求封装（含 token 刷新、错误码处理）
- **@sa/hooks** — 通用 Vue 组合式函数
- **@sa/utils** — 纯函数工具
- **@sa/color** — 颜色转换与调色
- **@sa/materials** — 业务组件与模板
- **@sa/scripts** — `sa` 命令行（gen-route / release / commit / cleanup）
- **@sa/uno-preset** — UnoCSS 预设（颜色 Token / 快捷类）

---

## 🎨 设计规范

- 详细页面结构与交互见 [`ui-design.md`](./ui-design.md)
- Web 球模块设计见 [`web.md`](./web.md)
- 默认深色主题，色板（`#2B6FF` / `#0B1220` / `#2EE59D` / `#FBBF24` / `#FB7185`）
- 字体：系统默认（Windows 优先 `Microsoft YaHei`）
- 圆角：按钮/输入框 `8`、卡片/面板 `12`
- 动效：面板展开收起 `180ms`、内容淡入 `120ms`

---

## 🤝 贡献指南

1. Fork & Clone
2. 创建特性分支：`git checkout -b feat/<name>`
3. 提交：遵循 [Conventional Commits](https://www.conventionalcommits.org/)，建议使用 `pnpm commit`
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

## 📄 许可证

[MIT](./LICENSE) © 2026 Geo-LLM
