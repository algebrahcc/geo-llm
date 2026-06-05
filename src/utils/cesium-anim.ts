/**
 * Cesium 散点涟漪动画工具
 *
 * 从 use-screen-globe.ts 提取，供大屏/仪表盘等场景复用。
 */
import {
  Cartesian3,
  Color,
  ColorMaterialProperty,
  ConstantProperty,
  HeightReference,
  type Viewer
} from 'cesium';

interface RingAnimState {
  radius: number;
  alpha: number;
}

interface ScatterPoint {
  id: string;
  longitude: number;
  latitude: number;
  value: number;
}

/** 将 value(0-100) 映射为蓝→青→绿→黄→橙→红色 */
export function valueToColor(value: number): Color {
  const t = Math.min(value / 100, 1);
  if (t < 0.2) {
    const s = t / 0.2;
    return Color.fromBytes(30, Math.floor(80 + s * 175), 255);
  } else if (t < 0.4) {
    const s = (t - 0.2) / 0.2;
    return Color.fromBytes(30, 255, Math.floor(255 - s * 155));
  } else if (t < 0.6) {
    const s = (t - 0.4) / 0.2;
    return Color.fromBytes(Math.floor(30 + s * 225), 255, Math.floor(100 - s * 100));
  } else if (t < 0.8) {
    const s = (t - 0.6) / 0.2;
    return Color.fromBytes(255, Math.floor(255 - s * 170), 0);
  }
  const s = (t - 0.8) / 0.2;
  return Color.fromBytes(255, Math.floor(85 - s * 85), 0);
}

/** 创建散点+涟漪 Entity */
export function addScatterPoints(
  viewer: Viewer,
  points: ScatterPoint[],
  ringStates: Map<string, RingAnimState>,
  pointEntities: any[]
) {
  points.forEach(point => {
    const position = Cartesian3.fromDegrees(point.longitude, point.latitude, 0);
    const color = valueToColor(point.value);
    const dotSize = 6 + (point.value / 100) * 6;

    const center = viewer.entities.add({
      id: `ripple-center-${point.id}`,
      position,
      point: {
        pixelSize: dotSize,
        color,
        outlineColor: Color.WHITE.withAlpha(0.7),
        outlineWidth: 1.5,
        heightReference: HeightReference.NONE,
        disableDepthTestDistance: Number.POSITIVE_INFINITY
      }
    });
    pointEntities.push(center);

    ringStates.set(`ring1-${point.id}`, { radius: 5000, alpha: 0.6 });
    const ring1 = viewer.entities.add({
      id: `ripple-ring1-${point.id}`,
      position,
      ellipse: {
        semiMinorAxis: new ConstantProperty(5000),
        semiMajorAxis: new ConstantProperty(5000),
        material: new ColorMaterialProperty(color.withAlpha(0.6)),
        height: 0,
        outline: false
      }
    });
    pointEntities.push(ring1);

    ringStates.set(`ring2-${point.id}`, { radius: 5000, alpha: 0.4 });
    const ring2 = viewer.entities.add({
      id: `ripple-ring2-${point.id}`,
      position,
      ellipse: {
        semiMinorAxis: new ConstantProperty(5000),
        semiMajorAxis: new ConstantProperty(5000),
        material: new ColorMaterialProperty(color.withAlpha(0.4)),
        height: 0,
        outline: false
      }
    });
    pointEntities.push(ring2);
  });
}

/** 更新涟漪动画状态（每 tick 调用） */
export function updateAnimState(
  points: ScatterPoint[],
  ringStates: Map<string, RingAnimState>,
  animStart: number
) {
  const now = Date.now();
  points.forEach(point => {
    const elapsed1 = (now - animStart) % 3000;
    const t1 = elapsed1 / 3000;
    ringStates.set(`ring1-${point.id}`, { radius: 5000 + t1 * 40000, alpha: 0.6 * (1 - t1) });

    const elapsed2 = (now - animStart + 1500) % 3000;
    const t2 = elapsed2 / 3000;
    ringStates.set(`ring2-${point.id}`, { radius: 5000 + t2 * 40000, alpha: 0.4 * (1 - t2) });
  });
}

/** 更新涟漪 Entity 属性（每 tick 调用） */
export function updateRingEntities(viewer: Viewer, points: ScatterPoint[], ringStates: Map<string, RingAnimState>) {
  points.forEach(point => {
    const color = valueToColor(point.value);

    [1, 2].forEach(ringIdx => {
      const key = `ring${ringIdx}-${point.id}`;
      const state = ringStates.get(key);
      const entity = viewer.entities.getById(`ripple-${key}`);
      if (state && entity?.ellipse) {
        entity.ellipse.semiMinorAxis = new ConstantProperty(state.radius);
        entity.ellipse.semiMajorAxis = new ConstantProperty(state.radius);
        entity.ellipse.material = new ColorMaterialProperty(color.withAlpha(state.alpha));
      }
    });
  });
}
