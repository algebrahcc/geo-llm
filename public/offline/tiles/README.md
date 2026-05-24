# 离线瓦片目录（XYZ / EPSG:3857）

将离线瓦片按 XYZ 目录结构放到本目录下：

```
public/offline/tiles/{z}/{x}/{y}.png
```

项目大屏页面默认会以如下地址加载瓦片：

```
/offline/tiles/{z}/{x}/{y}.png
```

如需修改，可在大屏页面调整组件参数：

- 组件：`OfflineOlMap`
- 参数：`tileUrl`（例如 `/offline/tiles/{z}/{x}/{y}.jpg`）
