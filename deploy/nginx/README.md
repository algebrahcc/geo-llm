# GeoLLM 前端部署（dist + Nginx 容器，纯 docker run）

前端是纯静态站点（`vite build --mode prod` 产出 `dist/`，约 1 GB，含 Cesium、三维瓦片、
影像切片与离线底图）。部署方式：**Nginx 容器托管 dist，并把后端接口反向代理出去。**
不使用 docker-compose，只用 `docker run`。

## 一、为什么用 Nginx 同源代理

不是"顺手代理一下"，有几条硬约束决定了必须这么做：

| 约束（来自代码）                                         | 后果                                                                                    |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `VITE_ROUTER_HISTORY_MODE=history`（`.env`）             | history 路由，直接刷新 `/screen`、`/agent` 会 404，必须 `try_files … /index.html`       |
| `index.html` 用**同步 XHR** 读 `/config.json`            | 必须**同源**，跨域 XHR 会被浏览器拦掉                                                   |
| `VITE_BASE_URL=/`，config.json 取绝对路径 `/config.json` | **只能部署在域名根路径**，不能挂到 `/admin` 子路径                                      |
| 后端 `context-path: /`，端口 prod 18000 / dev 8000       | 接口本身无前缀，由 Nginx 加 `/api` 前缀再剥掉，避免和前端路由 `/system`、`/screen` 撞车 |
| AI 对话/工作流是 **SSE 流式**                            | 代理必须关缓冲（`proxy_buffering off`），否则前端要等整段结束才收到                     |
| dist 内 ~1 GB 地图/三维数据与接口同域                    | 同源部署无 CORS，也不多耗跨域带宽                                                       |

## 二、文件

```
deploy/nginx/
  default.conf    Nginx 站点配置（挂到 /etc/nginx/conf.d/default.conf）
  run.sh          docker run 启动脚本（幂等，可重复执行）
  README.md       本文件
```

## 三、在新机器上部署

### 1. 准备

```bash
# 安装 docker（示例为 Debian/Ubuntu）
curl -fsSL https://get.docker.com | sh
docker version
```

拷两样东西到新机器：前端 `dist/`（约 1 GB）与 `deploy/nginx/`（本目录）。
放在同一父目录即可，例如 `/data/geo-llm-ui/{dist,nginx/}`。

> **拉不到官方镜像时**（内网/镜像源问题，`docker.io` 可能直接 not found）：用可用的加速地址，
> 下面这个实测可用；也可以直接用机器上已有的任一 nginx 基底镜像（如 `yuxi-web`、`dify-web`）。
>
> ```bash
> docker pull docker.m.daocloud.io/library/nginx:alpine
> IMAGE=docker.m.daocloud.io/library/nginx:alpine ./run.sh
> ```
>
> 完全不用容器也可以，见文末附录（宿主机 nginx）。

### 2. 改运行时配置（**关键一步，不需要重新打包**）

`dist/config.json` 是**运行时**配置，`index.html` 会在应用启动前读取并注入
`window.__APP_CONFIG__`，优先级高于打包时写死的值：

```jsonc
{
  // 后端接口地址：指向 Nginx 自己的 /api，由 Nginx 转发给后端
  "VITE_SERVICE_REAL_BASE_URL": "/api",

  // 以下按现场数据源改；留空或删除即回退内置默认值
  "VITE_GLOBE_URL": "http://192.168.12.211:19091/webglobe",
  "IMAGERY": {
    "mode": "local", // local=用 dist 自带影像；online=用 online.url
    "local": { "globalUrl": "google satellite-z0-8.yocMFTJvR/{z}/{x}/{y}.jpg" },
    "online": { "url": "http://<影像服务>/{z}/{x}/{y}.png" }
  },
  "TERRAIN": { "enabled": false, "url": "http://<地形服务>/{z}/{x}/{y}.terrain" }
}
```

改完刷新页面即生效（该文件响应头为 `no-cache`）。**同一份 dist 可部署到任意机器**，
只改这一个文件，无需重新打包。

### 3. 起容器

```bash
cd /data/geo-llm-ui/nginx
DIST_DIR=/data/geo-llm-ui/dist PORT=80 ./run.sh
docker ps --filter name=geo-llm-ui
docker logs -f geo-llm-ui
```

`run.sh` 做的事就是下面这条 `docker run`（可手动执行或按需改参数）：

```bash
docker run -d --name geo-llm-ui --restart unless-stopped \
  -p 80:80 \
  --add-host host.docker.internal:host-gateway \
  -v /data/geo-llm-ui/nginx/default.conf:/etc/nginx/conf.d/default.conf:ro \
  -v /data/geo-llm-ui/dist:/usr/share/nginx/html:ro \
  nginx:alpine
```

Windows（PowerShell，单行）：

```powershell
docker run -d --name geo-llm-ui --restart unless-stopped -p 80:80 `
  --add-host host.docker.internal:host-gateway `
  -v "D:\app\geo-llm-ui\nginx\default.conf:/etc/nginx/conf.d/default.conf:ro" `
  -v "D:\app\geo-llm-ui\dist:/usr/share/nginx/html:ro" nginx:alpine
```

**后端地址**在 `default.conf` 的 `proxy_pass` 里，默认 `http://host.docker.internal:18000/`
（后端用 systemd / JSW 跑在宿主机）。如果后端在别的机器或另一个容器：

- 别的机器：`proxy_pass http://192.168.1.10:18000/;`
- 另一个容器：`proxy_pass http://geo-llm-admin:18000/;`，并让两个容器在同一网络
  （`docker run --network <网络名> …`）

改完执行 `docker restart geo-llm-ui`。

> ⚠️ **`--add-host host.docker.internal:host-gateway` 不能省**：实测部分环境（含 Docker Desktop）
> 不写它时 `host.docker.internal` 会先解析到 **IPv6**，代理直接报
> `connect() to [xxxx::xxxx]:18000 failed (Network unreachable)` ✗；加上之后 upstream 变成 IPv4 网关，
> 链路正常（`Connection refused` 只表示后端没起）。
> 若仍不通，把 `proxy_pass` 写成宿主机 IPv4，例如 `http://10.116.192.180:18000/;`（最稳）。

### 4. 后端侧对齐

- `config/application-*.yml` 的 `application.url` 建议改成前端对外地址
  （WebSocket 的 `allowed-origins` 会用它）。
- 前后端不同机时，确认后端端口（prod 18000）对 Nginx 所在机器可达。

### 5. 验证

```bash
curl -I http://<前端地址>/                        # 200，text/html
curl -s http://<前端地址>/config.json             # 你改过的 JSON
curl -I http://<前端地址>/screen                  # 200（history 回退生效，不是 404）
curl -s -o /dev/null -w '%{http_code}\n' http://<前端地址>/api/auth/captcha   # 后端连通（非 502）
```

浏览器打开前端 → 登录页能显示、能登录即打通。

## 四、日常运维（docker 命令）

```bash
docker logs -f geo-llm-ui                     # 访问日志与代理报错
docker exec geo-llm-ui nginx -s reload        # 改了 default.conf 后热加载
docker restart geo-llm-ui                     # 或直接重启容器
docker rm -f geo-llm-ui                       # 停止并删除容器

# 改配置前先校验语法（用任意 nginx 基底镜像）
docker run --rm --entrypoint nginx \
  -v $PWD/default.conf:/etc/nginx/conf.d/default.conf:ro \
  nginx:alpine -t
```

**更新前端**：dist 是只读挂载，**替换目录里的文件即生效**，不需要重建容器
（`index.html` 为 `no-cache`，用户刷新即可拿到新版本）。

## 五、排错

| 现象                                           | 排查方向                                                                                                        |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| 打开是 404 / 空白                              | 挂载的 dist 不对：`docker logs geo-llm-ui` 看 `open() .../index.html failed`；确认 `DIST_DIR` 下有 `index.html` |
| 刷新子路由 404                                 | `try_files $uri $uri/ /index.html` 丢了；确认挂的是本目录的 `default.conf`                                      |
| 登录报网络错误 / 502                           | 后端没起或地址不对：`docker exec geo-llm-ui wget -qO- http://host.docker.internal:18000/api/auth/captcha`       |
| 502 且日志报 `Network unreachable` + IPv6 地址 | 容器少了 `--add-host host.docker.internal:host-gateway`（run.sh 已内置），或直接改用宿主机 IPv4                 |
| 改了 `config.json` 不生效                      | 浏览器缓存：确认 `/config.json` 响应头是 `Cache-Control: no-cache`，再强刷                                      |
| AI 对话没有逐字输出                            | 代理缓冲没关：`location /api/` 内需有 `proxy_buffering off`                                                     |
| AI 对话报错且指向 `localhost:8000`             | 构建产物的旧问题，见"已知限制"第 1 条                                                                           |
| 大文件上传 413                                 | `client_max_body_size`（本配置已设 1024m），并确认后端 `spring.servlet.multipart` 也放开                        |
| 地图/影像出不来                                | `config.json` 的 `IMAGERY.mode` 与 `local/online` 配置；Cesium 资源在 dist 内，不依赖外网                       |

## 六、已知限制

1. **`localhost:8000` 的遗留（本仓库已修，需重新构建一次）**
   `src/service/api/dify-stream.ts`（AI 对话/工作流流式接口）原先只读**打包时**的
   `VITE_SERVICE_REAL_BASE_URL`，没读运行时 `config.json` —— 那种 dist 里 AI 流式请求会固定发往
   `http://localhost:8000` ✗，在新机器上必然失败。现已统一改为 `getRealServiceBaseURL()`
   （与 `real.ts`、`vector.ts`、`monitor.ts`、`service-loader.ts` 同一来源），
   **需要重新 `npm run build` 一次**；之后换机器只改 `dist/config.json`。
2. **不支持子路径部署**：`VITE_BASE_URL=/` 且 config.json 走绝对路径 `/config.json`。
   要挂到 `https://域名/admin/` 需改 `.env` 的 `VITE_BASE_URL` 与 `index.html` 的加载路径后重新构建。
3. **WebSocket 未启用**：后端有 `/websocket`（`continew-starter.messaging.websocket.path`），
   前端当前未使用；将来对接时取消 `default.conf` 中该 location 的注释。
4. **dist 体积大**：约 1 GB / 5.5 万个文件，建议目录挂载分发（不要打进镜像层），
   传输前 `tar -czf dist.tar.gz dist` 可显著压缩。

## 附录：不用容器（宿主机 nginx）

`default.conf` 是标准 nginx 配置，可直接给宿主机 nginx 用：

```bash
sudo apt install -y nginx
sudo cp default.conf /etc/nginx/conf.d/geo-llm.conf
# 把 root 改成 dist 的绝对路径，并确认 proxy_pass 指向后端
sudo sed -i 's#/usr/share/nginx/html#/data/geo-llm-ui/dist#' /etc/nginx/conf.d/geo-llm.conf
sudo nginx -t && sudo systemctl reload nginx
```
