/**
 * 场景内核边界测试（RFC-0001 · 第 2 步）
 *
 * 这里锁的是**三条不变量**与它们要防的那类事故：
 *   1. 清理顺序：事件处理器 / 相机监听 → 最后才是 Viewer；
 *   2. 幂等：重复 dispose 只销毁一次；
 *   3. 异步兜底：销毁之后到达的异步结果一律不落地（`violations` 必须为空）。
 *
 * 断言全部走公开接口（mount / dispose / 命令方法）与替身的调用记录，
 * 不触碰核心内部状态，因此后续重构不应让它们变红。
 */
import { describe, expect, it, vi } from 'vitest';
import { createScene } from '../create-scene';
import { createFakeNotify, createFakeSceneKit, createStubSceneDeps } from '../../testing/fakes';

/** 建一个已挂载的场景（容器用一个占位元素） */
async function mountFakeScene() {
  const fake = createFakeSceneKit();
  const notify = createFakeNotify();
  const scene = createScene({
    deps: createStubSceneDeps({ kit: fake.kit, notify: notify.port })
  });
  scene.container.value = {} as HTMLElement;
  await scene.mount();
  return { fake, notify, scene };
}

describe('挂载', () => {
  it('容器未就绪时不创建 Viewer（幂等：无容器、已挂载都直接返回）', async () => {
    const fake = createFakeSceneKit();
    const scene = createScene({ deps: createStubSceneDeps({ kit: fake.kit }) });

    await scene.mount();
    expect(fake.log).toEqual([]);

    scene.container.value = {} as HTMLElement;
    await scene.mount();
    const afterFirst = fake.log.length;
    await scene.mount(); // 第二次挂载不应重复创建

    expect(fake.log.filter(op => op === 'kit.createViewer')).toHaveLength(1);
    expect(afterFirst).toBe(fake.log.length);
    expect(scene.alive).toBe(true);
  });

  it('挂载序列：建 Viewer → prepare → 清影像 → 挂兜底影像 → 请求地形', async () => {
    const fake = createFakeSceneKit();
    const scene = createScene({ deps: createStubSceneDeps({ kit: fake.kit }) });
    scene.container.value = {} as HTMLElement;

    await scene.mount({ prepare: () => fake.log.push('hook.prepare') });

    expect(fake.log).toEqual([
      'kit.createViewer',
      'hook.prepare',
      'imagery.removeAll',
      'kit.imageryProviders',
      'imagery.add',
      // 兜底图层绑定登记表 → 立刻回放真相（默认可见）
      'imagery.visible=true',
      'imagery.opacity=1',
      'kit.createTerrain'
    ]);
  });

  it('地形 provider 在挂载后异步落地', async () => {
    const { fake, scene } = await mountFakeScene();
    expect(fake.terrainAssignments()).toBe(0);

    fake.resolveTerrain();
    await Promise.resolve();
    await Promise.resolve();

    expect(fake.terrainAssignments()).toBe(1);
    expect(fake.violations).toEqual([]);
    expect(scene.alive).toBe(true);
  });

  it('addFallbackImagery 只追加、不做 removeAll（供 applyServices 回退复用同一份构造）', async () => {
    const { fake, scene } = await mountFakeScene();
    const before = fake.log.length;

    scene.addFallbackImagery();

    expect(fake.log.slice(before)).toEqual([
      'kit.imageryProviders',
      'imagery.add',
      'imagery.visible=true',
      'imagery.opacity=1'
    ]);
    expect(scene.imageryLayers).toHaveLength(2); // 挂载时的 1 层 + 回退的 1 层
  });

  it('底图开关只作用于兜底影像 key，不碰其它图层（缺陷 1 回归）', async () => {
    const { fake, scene } = await mountFakeScene();
    const before = fake.log.length;

    scene.setBaseImageryVisible(false);

    expect(fake.log.slice(before)).toEqual(['imagery.visible=false', 'imagery.opacity=1']);
    expect(scene.layers.get('fallback-imagery').visible).toBe(false);
  });

  it('隐藏底图后新增的兜底图层立刻就是隐藏的（缺陷 2 回归）', async () => {
    const { fake, scene } = await mountFakeScene();
    scene.setBaseImageryVisible(false);
    const before = fake.log.length;

    scene.addFallbackImagery();

    // 新建图层在 attach 时即被设为隐藏，而不是先 show=true 再被纠正
    expect(fake.log.slice(before)).toEqual([
      'kit.imageryProviders',
      'imagery.add',
      'imagery.visible=false',
      'imagery.opacity=1'
    ]);
  });

  it('挂载前关掉底图，挂载时不会被重置为可见（register 不覆盖既有真相）', async () => {
    const fake = createFakeSceneKit();
    const scene = createScene({ deps: createStubSceneDeps({ kit: fake.kit }) });

    scene.setBaseImageryVisible(false); // 发生在挂载之前
    scene.container.value = {} as HTMLElement;
    await scene.mount();

    expect(fake.log).toContain('imagery.visible=false');
    expect(fake.log).not.toContain('imagery.visible=true');
  });

  it('核心自身从不调用逃生口 rawViewer()（逃生口只属于薄壳）', async () => {
    const { fake, scene } = await mountFakeScene();

    scene.bindMouseEvents({ onMouseMove: () => {} });
    scene.flyTo(120, 24);
    await scene.dispose();

    expect(fake.log).not.toContain('viewer.rawViewer');
  });
});

describe('清理不变量', () => {
  it('顺序：事件处理器与相机监听先清理，Viewer 最后销毁', async () => {
    const { fake, scene } = await mountFakeScene();

    scene.bindMouseEvents({ onMouseMove: () => {} });
    scene.onCameraChange(() => {});
    const beforeDispose = fake.log.length;

    await scene.dispose();

    const afterDispose = fake.log.slice(beforeDispose);
    // 真正的不变量是「事件处理器与相机监听都在 Viewer 之前释放」。
    // 这两者之间彼此无依赖（相对次序由入栈顺序决定），因此不写死它们的先后。
    expect(afterDispose).toEqual(['camera.offChange', 'handler.destroy', 'viewer.destroy']);
    expect(afterDispose[afterDispose.length - 1]).toBe('viewer.destroy');
  });

  it('幂等：重复 dispose 只销毁一次，且 alive 立刻为 false', async () => {
    const { fake, scene } = await mountFakeScene();

    await scene.dispose();
    expect(scene.alive).toBe(false);

    await scene.dispose();
    await scene.dispose();

    expect(fake.destroyCount()).toBe(1);
  });

  it('销毁之后所有命令静默短路，不再触碰端口', async () => {
    const { fake, scene } = await mountFakeScene();
    await scene.dispose();

    const before = fake.log.length;
    scene.requestRender();
    scene.flyTo(120, 24);
    scene.zoomIn();
    scene.zoomOut();
    scene.rotate();
    scene.pitch();
    scene.toggleViewMode();
    scene.setGlobeSurfaceTranslucent(true);
    scene.bindMouseEvents({ onMouseMove: () => {} });
    scene.exportScreenshot('x.png');

    expect(fake.log.length).toBe(before);
    expect(fake.violations).toEqual([]);
  });

  it('销毁之后异步到达的地形 provider 不落地（无写入、无违规）', async () => {
    const { fake, scene } = await mountFakeScene();
    await scene.dispose();

    fake.resolveTerrain();
    await Promise.resolve();
    await Promise.resolve();

    expect(fake.terrainAssignments()).toBe(0);
    expect(fake.violations).toEqual([]);
  });

  it('清理动作抛错不影响其余清理，也不向外抛', async () => {
    const { fake, scene } = await mountFakeScene();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const original = fake.kit.createEventHandler;

    scene.bindMouseEvents({ onMouseMove: () => {} });
    // 让事件处理器销毁时抛错
    fake.kit.createEventHandler = surface => {
      const handler = original(surface);
      handler.destroy = () => {
        throw new Error('handler 销毁失败');
      };
      return handler;
    };
    scene.bindMouseEvents({ onMouseMove: () => {} });

    await expect(scene.dispose()).resolves.toBeUndefined();
    expect(fake.destroyCount()).toBe(1); // 后面的 viewer.destroy 仍然执行
    expect(warn).toHaveBeenCalled();
  });

  it('全同步清理不引入微任务延迟：dispose 调用后 Viewer 已同步销毁', async () => {
    const { fake, scene } = await mountFakeScene();
    scene.bindMouseEvents({ onMouseMove: () => {} });

    // 刻意不 await：旧的 destroyViewer 是同步销毁，调用方可能依赖这一点
    // （例如同一 tick 内在同一容器上重建 Viewer）
    const pending = scene.dispose();
    expect(fake.destroyCount()).toBe(1);

    await pending;
    expect(scene.alive).toBe(false);
  });
});

describe('基础能力', () => {
  it('2D/3D 切换：切换 2D 时关闭旋转与倾斜，并翻转 is2d', async () => {
    const { fake, scene } = await mountFakeScene();

    scene.toggleViewMode();
    expect(scene.is2d.value).toBe(true);
    expect(fake.log).toContain('scene.morphTo2D(0)');
    expect(fake.log).toContain('scene.setController(enableRotate+enableTilt)');

    scene.toggleViewMode();
    expect(scene.is2d.value).toBe(false);
    expect(fake.log).toContain('scene.morphTo3D(0)');
  });

  it('地表透视：半透明参数、深度测试、相机控制器一次设好并请求重绘', async () => {
    const { fake, scene } = await mountFakeScene();

    scene.setGlobeSurfaceTranslucent(true);
    expect(fake.log).toContain('globe.translucency(0.32)');
    expect(fake.log).toContain('globe.depthTest(true)');
    expect(fake.log).toContain('scene.setController(enableCollisionDetection+minimumZoomDistance)');
    expect(fake.log).toContain('scene.requestRender');

    // 重复设置同一值不应重复下发
    const before = fake.log.length;
    scene.setGlobeSurfaceTranslucent(true);
    expect(fake.log.length).toBe(before);
  });

  it('状态与坐标浮窗：有交点时输出经纬高，无交点时为 --', async () => {
    const { fake, scene } = await mountFakeScene();

    // 用不会被二进制浮点舍入影响的值：120.12345 / 24.12345 的 toFixed(4) 结果并不一致
    fake.setGeo({ longitude: 120.1234, latitude: 24.1234, height: 12.5 });
    const withGeo = scene.computeBaseStatus({ opaque: true });
    expect(withGeo.longitude).toBe('120.1234');
    expect(withGeo.latitude).toBe('24.1234');
    expect(withGeo.altitude).toBe('13 m');
    expect(withGeo.cameraHeight).toBe('1.0 km');

    fake.setGeo(null);
    const withoutGeo = scene.computeBaseStatus({ opaque: true });
    expect(withoutGeo.longitude).toBe('--');
    expect(withoutGeo.altitude).toBe('--');
  });

  it('截图：渲染 → 落盘 → 成功提示；落盘抛错时报错提示且不外抛', async () => {
    const { fake, notify, scene } = await mountFakeScene();

    scene.exportScreenshot('shot.png');
    expect(fake.log).toContain('scene.render');
    expect(notify.messages[notify.messages.length - 1]?.level).toBe('success');

    // 换成会抛错的落盘实现，验证错误分支
    (scene.deps.exporter as { saveDataUrl: () => void }).saveDataUrl = () => {
      throw new Error('落盘失败');
    };
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => scene.exportScreenshot('shot.png')).not.toThrow();
    expect(notify.messages[notify.messages.length - 1]?.level).toBe('error');
    expect(error).toHaveBeenCalled();
  });
});
