/**
 * 街景数据来源工厂
 *
 * 单独成一个模块（而不是留在 service-loader 里）的理由：球上加载与数据服务页的
 * 「街景自检」必须用**同一套**来源判定与参数解析 —— 否则会出现「自检通过、球上加载失败」
 * 这种互相矛盾的结论。判定口径只看数据服务条目本身：
 *
 *  - `origin=external` 或 url 为 http(s) → 远程街景服务（另配 rid / level）
 *  - 相对路径 → 前端 `public` 下的本地目录（另配 pointsFile / imageTemplate）
 *
 * 后端 `data_service` 与枚举无需为本地模式做任何改动。
 */
import { createLocalStreetViewSource } from './local-source';
import { createRemoteStreetViewSource } from './remote-source';
import { isLocalStreetViewSource, parseStreetViewParams, type StreetViewSource } from './service-api';

export function createStreetViewSourceOf(
  service: Pick<Api.DataService.DataServiceItem, 'name' | 'origin' | 'url' | 'params'>,
  baseUrl: string
): StreetViewSource {
  const params = parseStreetViewParams(service.params);

  if (isLocalStreetViewSource(service)) {
    return createLocalStreetViewSource({
      baseUrl,
      pointsFile: params.pointsFile,
      imageTemplate: params.imageTemplate,
      label: service.name
    });
  }

  return createRemoteStreetViewSource({
    baseUrl,
    rid: params.rid,
    level: params.level,
    label: service.name
  });
}
