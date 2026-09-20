/**
 * 端口边界测试（RFC-0001 · 第 1 步）
 *
 * 只测「可注入替身」的那批端口（提示 / 配置 / 定时器 / 数据）；
 * 创建 Viewer 的造物适配器需要浏览器与 WebGL，留给后续步骤的真机契约测试。
 *
 * 这些断言描述的是**契约行为**（谁优先、缺失怎么办、失败兜底成什么），
 * 不是实现细节，因此内部重构不应让它们变红。
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  SERVICE_LOAD_TIMEOUT_MS,
  createEnvConfigPort,
  createNotifyPort,
  createServiceSource,
  createTimersPort,
  createVectorSource
} from '../adapters';
import { fetchEnabledDataServices } from '@/service/api/dataservice';
import { fetchVectorExtent, getVectorTileUrl } from '@/service/api/vector';

vi.mock('@/service/api/dataservice', () => ({ fetchEnabledDataServices: vi.fn() }));
vi.mock('@/service/api/vector', () => ({ fetchVectorExtent: vi.fn(), getVectorTileUrl: vi.fn() }));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('配置端口', () => {
  it('超时常量只有一个来源（现状两处 8000 的收敛点）', () => {
    expect(SERVICE_LOAD_TIMEOUT_MS).toBe(8000);
    expect(createEnvConfigPort().serviceTimeoutMs).toBe(SERVICE_LOAD_TIMEOUT_MS);
  });

  it('publicBaseUrl 返回 vite 的 BASE_URL', () => {
    expect(createEnvConfigPort().publicBaseUrl()).toMatch(/^\//);
  });

  it('serviceBaseUrl 优先取运行时配置 window.__APP_CONFIG__', () => {
    vi.stubGlobal('window', { __APP_CONFIG__: { VITE_SERVICE_REAL_BASE_URL: '/api' } });
    expect(createEnvConfigPort().serviceBaseUrl()).toBe('/api');
  });

  it('无运行时配置时回退到构建期变量或内置默认值（Node 下不得抛错）', () => {
    vi.stubGlobal('window', {});
    const url = createEnvConfigPort().serviceBaseUrl();
    expect(typeof url).toBe('string');
    expect(url.length).toBeGreaterThan(0);
  });
});

describe('提示端口', () => {
  it('把四类提示转发给 window.$message', () => {
    const message = {
      success: vi.fn(),
      warning: vi.fn(),
      error: vi.fn(),
      loading: vi.fn(() => ({ destroy: vi.fn() }))
    };
    vi.stubGlobal('window', { $message: message });
    const notify = createNotifyPort();

    notify.success('a');
    notify.warning('b');
    notify.error('c');

    expect(message.success).toHaveBeenCalledWith('a');
    expect(message.warning).toHaveBeenCalledWith('b');
    expect(message.error).toHaveBeenCalledWith('c');
  });

  it('loading 句柄释放时销毁提示（duration=0 常驻）', () => {
    const destroy = vi.fn();
    const loading = vi.fn(() => ({ destroy }));
    vi.stubGlobal('window', { $message: { loading } });

    createNotifyPort().loading('加载中').dispose();

    expect(loading).toHaveBeenCalledWith('加载中', { duration: 0 });
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it('$message 尚不可用时不抛错（应用初始化早期的场景）', () => {
    vi.stubGlobal('window', {});
    const notify = createNotifyPort();
    expect(() => {
      notify.error('x');
      notify.loading('y').dispose();
    }).not.toThrow();
  });
});

describe('定时器端口', () => {
  it('转发到全局定时器，可被虚拟时钟驱动', () => {
    vi.useFakeTimers();
    const handler = vi.fn();
    const timers = createTimersPort();

    const id = timers.setTimeout(handler, 100);
    vi.advanceTimersByTime(99);
    expect(handler).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(handler).toHaveBeenCalledTimes(1);

    expect(() => timers.clearTimeout(id)).not.toThrow();
    vi.useRealTimers();
  });

  it('now 返回毫秒时间戳', () => {
    expect(Math.abs(createTimersPort().now() - Date.now())).toBeLessThan(1000);
  });
});

describe('数据端口', () => {
  it('listEnabled 解包 mica 信封，调用方直接拿到业务数组', async () => {
    const items = [{ id: 1, name: '影像服务' }];
    vi.mocked(fetchEnabledDataServices).mockResolvedValue({ data: { code: '0000', data: items } } as never);

    await expect(createServiceSource().listEnabled()).resolves.toEqual(items);
  });

  it('listEnabled 在响应为 null 时兜底为 []（面板列表不会因空响应消失）', async () => {
    vi.mocked(fetchEnabledDataServices).mockResolvedValue(null as never);

    await expect(createServiceSource().listEnabled()).resolves.toEqual([]);
  });

  it('vector.extent 解包业务数据；tileUrl 直接透传', async () => {
    vi.mocked(fetchVectorExtent).mockResolvedValue({ data: [120, 24, 121, 25] } as never);
    vi.mocked(getVectorTileUrl).mockReturnValue('http://host/system/vector/tile/1/{z}/{x}/{y}.pbf');

    const source = createVectorSource();

    await expect(source.extent('1')).resolves.toEqual([120, 24, 121, 25]);
    expect(source.tileUrl('1', 'geojson')).toBe('http://host/system/vector/tile/1/{z}/{x}/{y}.pbf');
  });
});
