#!/usr/bin/env bash
#
# GeoLLM 前端：用 docker run 起 Nginx 静态站点（不使用 docker-compose）
#
# 用法：
#   ./run.sh                                  # 默认：dist 在同级 ../../dist，宿主 80 端口
#   PORT=8080 ./run.sh                        # 换宿主端口
#   DIST_DIR=/data/geo-llm-ui/dist ./run.sh   # 指定 dist 目录
#   IMAGE=nginx:1.27-alpine ./run.sh          # 指定镜像
#
# 后端地址在 default.conf 里（proxy_pass），改完用： docker restart geo-llm-ui
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONF="$SCRIPT_DIR/default.conf"
DIST_DIR="${DIST_DIR:-$(cd "$SCRIPT_DIR/../.." && pwd)/dist}"
IMAGE="${IMAGE:-nginx:alpine}"
NAME="${NAME:-geo-llm-ui}"
PORT="${PORT:-80}"
# 后端不在宿主机（例如在别的机器或另一个容器）时，改 default.conf 的 proxy_pass：
#   别的机器   → proxy_pass http://192.168.1.10:18000/;   （写 IPv4 最稳）
#   另一个容器 → proxy_pass http://geo-llm-admin:18000/;  并让两个容器在同一网络
# 下面的 --add-host 不可省：否则 host.docker.internal 可能先解析到 IPv6 而报 Network unreachable
BACKEND_HINT="host.docker.internal:18000"

command -v docker >/dev/null 2>&1 || { echo "未找到 docker，请先安装" >&2; exit 1; }
[[ -f "$CONF" ]] || { echo "缺少 $CONF" >&2; exit 1; }
[[ -f "$DIST_DIR/index.html" ]] || { echo "DIST_DIR 里没有 index.html：$DIST_DIR" >&2; exit 1; }
[[ -f "$DIST_DIR/config.json" ]] || echo "提示：$DIST_DIR/config.json 不存在，前端将回退到打包时的内置地址"

echo "镜像    : $IMAGE"
echo "dist    : $DIST_DIR"
echo "宿主机端口: $PORT → 容器 80"
echo "后端地址: $BACKEND_HINT（在 default.conf 中配置）"

# 同名容器先清掉，保证重复执行是幂等的
docker rm -f "$NAME" >/dev/null 2>&1 || true

docker run -d \
  --name "$NAME" \
  --restart unless-stopped \
  -p "${PORT}:80" \
  --add-host host.docker.internal:host-gateway \
  -v "$CONF:/etc/nginx/conf.d/default.conf:ro" \
  -v "$DIST_DIR:/usr/share/nginx/html:ro" \
  "$IMAGE" >/dev/null

sleep 1
echo
echo "启动结果："
docker ps --filter "name=^/${NAME}$" --format '  {{.Names}}  {{.Status}}  {{.Ports}}'
echo
echo "看日志： docker logs -f $NAME"
echo "停止  ： docker rm -f $NAME"
