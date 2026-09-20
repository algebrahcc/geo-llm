/**
 * 图层显隐登记表测试（RFC-0001 · 第 3 步）
 *
 * 重点是两条回归：
 *   - 「重建后回放真相」——对应用户隐藏的服务层在 applyServices 之后自己亮回来；
 *   - 「一个 key 一个真相」——对应底图开关误伤数据服务影像。
 */
import { describe, expect, it } from 'vitest';
import { createLayerRegistry, type LayerTarget } from '../layer-registry';

/** 记录下发的显隐指令（模拟 Cesium 图层） */
function createTarget(name: string) {
  const calls: string[] = [];
  const target: LayerTarget = {
    setVisible: visible => calls.push(`${name}.visible=${visible}`),
    setOpacity: opacity => calls.push(`${name}.opacity=${opacity}`)
  };
  return { calls, target };
}

describe('真相与投影', () => {
  it('绑定图层时立即回放当前真相（新图层不再是 Cesium 默认的 visible）', () => {
    const registry = createLayerRegistry();
    const layer = createTarget('layer');

    registry.setVisible('service:1', false);
    registry.attach('service:1', layer.target);

    // 重建后的新图层直接被设成隐藏 —— 这正是缺陷 2 的回归点
    expect(layer.calls).toEqual(['layer.visible=false', 'layer.opacity=1']);
    expect(registry.get('service:1').visible).toBe(false);
  });

  it('设置显隐会作用到所有已绑定图层', () => {
    const registry = createLayerRegistry();
    const first = createTarget('first');
    const second = createTarget('second');

    registry.attach('vector:9', [first.target, second.target]);
    registry.setVisible('vector:9', false);

    expect(first.calls).toEqual(['first.visible=true', 'first.opacity=1', 'first.visible=false', 'first.opacity=1']);
    expect(second.calls).toEqual([
      'second.visible=true',
      'second.opacity=1',
      'second.visible=false',
      'second.opacity=1'
    ]);
  });

  it('重新绑定会替换旧投影，旧图层不再被写（重建路径不会留下幽灵写入）', () => {
    const registry = createLayerRegistry();
    const oldLayer = createTarget('old');
    const newLayer = createTarget('new');

    registry.attach('service:2', oldLayer.target);
    registry.setVisible('service:2', false);
    registry.attach('service:2', newLayer.target);

    const oldCountAfterReplace = oldLayer.calls.length;
    registry.setVisible('service:2', true);

    // 新图层绑定发生在真相已为 false 之后 → 先被设为隐藏，再跟随后续变更
    expect(newLayer.calls).toEqual(['new.visible=false', 'new.opacity=1', 'new.visible=true', 'new.opacity=1']);
    expect(oldLayer.calls.length).toBe(oldCountAfterReplace);
  });

  it('一个 key 一个真相：不同 key 互不影响（底图开关不再误伤服务影像）', () => {
    const registry = createLayerRegistry();
    const baseImagery = createTarget('base');
    const serviceImagery = createTarget('service');

    registry.attach('fallback-imagery', baseImagery.target);
    registry.attach('service:7', serviceImagery.target);

    registry.setVisible('fallback-imagery', false);

    expect(baseImagery.calls).toContain('base.visible=false');
    expect(serviceImagery.calls).not.toContain('service.visible=false');
    expect(registry.get('service:7').visible).toBe(true);
  });

  it('透明度也走同一条真相，并在绑定/重建时回放', () => {
    const registry = createLayerRegistry();
    const layer = createTarget('layer');

    registry.setOpacity('service:3', 0.4);
    registry.attach('service:3', layer.target);

    expect(layer.calls).toEqual(['layer.visible=true', 'layer.opacity=0.4']);
  });
});

describe('登记与释放', () => {
  it('register 不覆盖既有真相（重建时不会把用户状态重置为默认）', () => {
    const registry = createLayerRegistry();
    registry.setVisible('vector:1', false);

    registry.register('vector:1', { visible: true });

    expect(registry.get('vector:1').visible).toBe(false);
  });

  it('未登记的 key 读取返回默认值且不产生副作用', () => {
    const registry = createLayerRegistry();

    expect(registry.get('unknown')).toEqual({ visible: true, opacity: 1 });
    expect(registry.has('unknown')).toBe(false);
    expect(registry.keys()).toEqual([]);
  });

  it('attach(null) 只解绑投影、保留真相（图层被销毁时不要丢状态）', () => {
    const registry = createLayerRegistry();
    const layer = createTarget('layer');

    registry.attach('service:4', layer.target);
    registry.setVisible('service:4', false);
    registry.attach('service:4', null);

    const callsAfterDetach = layer.calls.length;
    registry.setVisible('service:4', true);

    expect(layer.calls.length).toBe(callsAfterDetach); // 已解绑，不再下发
    expect(registry.get('service:4').visible).toBe(true); // 但真相仍在
  });

  it('remove 之后该 key 的真相与投影都被清空', () => {
    const registry = createLayerRegistry();
    const layer = createTarget('layer');

    registry.attach('vector:2', layer.target);
    registry.remove('vector:2');

    expect(registry.has('vector:2')).toBe(false);
    expect(registry.get('vector:2')).toEqual({ visible: true, opacity: 1 });
    expect(registry.keys()).toEqual([]);
  });
});
