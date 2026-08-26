# geo-llm-ui 领域上下文

geo-llm-ui 是地理大数据平台的前端仓库，与 geo-llm-admin 后端及 Dify 智能体平台共同构成系统。本术语表聚焦数据目录与 AI 智能体（影像切片提交）相关的领域语言。

## Language

**数据目录 (Data Catalog)**：
影像元数据登记与 MinIO 文件落地模块，后端前缀 `/service/catalog`；是"查找影像"的唯一权威来源。
_Avoid_: 目录、文件库

**影像 (Imagery)**：
已登记的数据目录条目所指向的影像文件；二进制存放于 MinIO，通过 presigned URL 临时访问。

**影像切片服务 (Imagery Tiling Service)**：
独立外部服务，接收影像文件流并生成/管理切片；只接受 multipart 二进制，不支持 URL 或 objectKey 接入。
_Avoid_: 切片服务（歧义：知识库的"文档切片"指文档分段）、瓦片服务

**presigned URL**：
由数据目录 `download-url` 生成的、带签名且临时有效的文件下载地址；下游无需额外鉴权即可拉取。

**薄 HTTP 桥 (Upload Bridge)**：
从 presigned URL 拉取文件流并以 multipart 转发给影像切片服务的中间服务；是"JSON 工具入参 → 二进制文件流"的唯一适配点。
_Avoid_: 桥服务、中转服务、MCP Server

**切片提交 (Tiling Submission)**：
将已登记影像的文件流提交给影像切片服务的行为；区别于数据目录的上传（落地 MinIO）。
_Avoid_: 上传影像（歧义：数据目录的上传是往 MinIO 放文件）

**Dify 原生 Agent (Native Agent)**：
Dify 1.16 中 mode=agent 的应用形态；切片提交链路（查询 → 取地址 → 提交）的宿主，负责自然语言理解与多步工具调用。

**Dify Swagger 工具 (Swagger Tool)**：
通过导入 OpenAPI 规范在 Dify 中生成的 HTTP 工具；工具入参为 JSON，不能承载二进制文件流。
_Avoid_: MCP 工具

**MCP (Model Context Protocol)**：
模型上下文协议；本项目仅用于 JSON 类接口的接入，不用于二进制文件流转（见 ADR-0001）。
