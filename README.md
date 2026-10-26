# 再见，太阳系 · Beyond Sol

一部向《流浪地球》致敬的 **three.js 实时交互宇宙旅程**。
约 2 分 54 秒、六个章节：从一万两千台行星发动机点火，到穿越太阳系、日球层顶、星际空间，拉远到整个银河系，最后抵达比邻星（4.3 光年）的新太阳。

画面全部实时渲染：GLSL 着色器 + 后期泛光，配乐由 Web Audio 实时合成，没有一帧预渲染视频。

## 运行

需要 Node.js 18 及以上。

```bash
npm install
npm run dev        # 开发模式，自动打开 http://localhost:5173
```

打包成静态网站（可以丢到任何静态托管，或者离线用）：

```bash
npm run build      # 输出到 dist/
npm run preview    # 本地预览打包结果
```

> 推荐桌面版 Chrome / Edge，独立显卡体验最好。首次加载约 110 MB 贴图（8K 贴图走 KTX2；不支持 KTX2 或加 `?ktx2=0` 时约 30 MB）。

## 操作

| 操作 | 作用 |
| --- | --- |
| 空格 | 播放 / 暂停影片 |
| ← / → | 后退 / 前进 5 秒 |
| 影片中滚动鼠标滚轮 | 穿越时间（拖动时间线） |
| 底部章节条 | 点击跳章 |
| F 或右上角「探索」 | 自由探索：拖拽旋转、滚轮缩放、点目的地飞过去 |
| M / ♪ | 声音开关 |
| H / ◐ | 隐藏仪表盘 |
| ⛶ | 全屏 |

调试参数：`?t=秒` 定格到影片某一时刻；`?dpr=1` 降低渲染分辨率（集显卡顿时有用）；`?autoplay` 跳过开始按钮。

## 六个章节

| # | 章节 | 内容 |
| --- | --- | --- |
| 01 | 流浪地球 | 点火从重型阵列开始向整个半球蔓延；加蓬外海的太空电梯（片头即已建成），攀爬舱升到同步轨道；方舟号国际空间站（同步轨道船坞，在建）；领航员国际空间站（单座，按电影还原） |
| 02 | 太阳系 | 时间压缩下的太阳系俯瞰与地球外旋航迹；衰老的太阳（米粒组织、黑子、日珥、日冕物质抛射）；木星引力弹射；土星环 |
| 03 | 超越外行星 | 海王星；柯伊伯带冰屑；越过日球层顶 |
| 04 | 星际航行 | 冰封的地球与地下城灯网；弓形激波与极光；渐亮的比邻星 |
| 05 | 银河系 | 对数尺度连续拉远：太阳—比邻星航线 → 本地泡 → 猎户臂 → 36 万粒子的棒旋银河 |
| 06 | 新太阳 | 掉头反推减速，被新恒星照亮 |

## 结构

```
index.html              页面外壳与 HUD 布局
src/main.js             渲染器、后期（泛光 + 色差/暗角/颗粒）、导演（世界切换、镜头、转场）、探索模式
src/story.js            剧本：章节、字幕、事件日志、遥测关键帧
src/hud.js              仪表盘：推进 / 导航面板、雷达、波形、日志、章节条、标题卡
src/audio.js            生成式配乐（Web Audio）
src/assets.js           贴图加载（8K 贴图优先 KTX2，不支持时回退 JPG）
src/data/near-stars.js  HYG 星表中 100 光年内的恒星（由 tools/near-stars.mjs 生成）
src/worlds/earth.js     地球世界（1 单位 = 地球半径）：地球着色器、发动机网络、电梯、方舟号、领航员号、行星飞掠、星际特效
src/worlds/solar.js     太阳系世界（艺术化尺度 R = 6·r^0.6）
src/worlds/galaxy.js    银河世界（1 单位 = 1 光年）
src/fx/plumes.js        等离子光柱：沿轴朝向相机的实例化条带，一次 draw call 画上万条
src/fx/kit.js           硬表面拼装建模（舰船、空间站、攀爬舱、桁架）
src/fx/shaders.js       地球、云、大气、行星、光晕等着色器
src/fx/space.js         银河天空、星点、速度流线、冰屑
public/assets/          贴图（JPG + 8K 的 KTX2）、basis 转码器、字体
tools/                  开发工具（全部 Node）：截图 shots.mjs、冒烟测试 smoke.mjs、字体子集化 subset-font.mjs、星表生成 near-stars.mjs
tools/fonts/            完整的 Noto Sans SC 可变字重源文件（只供裁剪，不进打包产物）
```

## 开发工具

```bash
npm run font                          # 改过中文文本后重新裁剪 HUD 字体（扫描 src/**/*.js 与 index.html）
npm run smoke                         # 冒烟测试：开始播放、确认时间前进、三个世界的探索目的地全部飞一遍；出错时非 0 退出
node tools/shots.mjs 55,90,160 1280 720   # 定格截图：时间点、宽、高
node tools/near-stars.mjs             # 重新生成近邻星表（自动下载 HYG v4.4）
```

Playwright 启动失败时，先运行 `npx playwright install chromium`，再按提示安装系统依赖（`sudo npx playwright install-deps chromium`）。

### 贴图压缩（KTX2）

`earth_day`、`earth_night`、`earth_clouds`、`jupiter` 四张 8K 贴图另存为 KTX2（UASTC + Zstd，带 mipmap）。浏览器支持任何 GPU 压缩格式时用 KTX2，显存占用约为 JPG 解码后的 1/4–1/8；否则或加载失败时逐张回退 JPG。地址栏加 `?ktx2=0` 可强制 JPG。重新编码用 [basisu](https://github.com/BinomialLLC/basis_universal)：

```bash
basisu -uastc -uastc_level 2 -mipmap -y_flip -srgb   -ktx2 earth_day.jpg   # 颜色贴图（day / night / jupiter）
basisu -uastc -uastc_level 2 -mipmap -y_flip -linear -ktx2 earth_clouds.jpg
```

## 素材来源与授权

- 行星、太阳、地球昼/夜/云/法线/镜面贴图：Solar System Scope（solarsystemscope.com/textures），CC BY 4.0，经由 Wikimedia Commons 获取
- 银河全景：ESO / S. Brunier，“The Milky Way panorama”，CC BY 4.0
- 近邻恒星：HYG 星表 v4.4（David Nash / astronexus，codeberg.org/astronexus/hyg），CC BY-SA 4.0；src/data/near-stars.js 为其衍生数据，同样以 CC BY-SA 4.0 提供
- 字体：Orbitron、Rajdhani、JetBrains Mono、Noto Sans SC（均为 SIL Open Font License 1.1）
- 舰船、空间站、发动机、银河系全部为程序化生成；配乐为程序实时合成
- 代码：MIT

本作品是受《流浪地球》启发的同人创作，与电影出品方及版权方无关。


## 方舟号站体

站体造型参考 oxomkbk/earth-migration（MIT）的同步轨道站；三向投影 PBR 着色移植自同项目 `js/fx/triplanar.js`。贴图 `public/assets/tex/pbr/` 来自 Poly Haven（metal_plate_02、painted_metal_shutter、blue_metal_plate），CC0。
