# 五类分类入口组件图 · 生成记录

使用内置 image_gen 工具。每类为独立位图素材，图标、底块与底块内部颜色属于同一 PNG；分类名称在 Figma 中另建原生文字。最终采用白色画布，适配当前首页白色分类栏。未修改小程序代码。

视觉依据：当前 `spec.md` 的清爽、轻量、校园感，以及 `#3B82F6` / `#60A5FA` 配色；聊天工具图标的圆角蓝色线条 `#005CC1`；此前确认的首页五分类浅色圆角入口。

## 01 数码电子 · 基准图

```text
Use case: ui-mockup.
Asset type: a single premium category-entry icon tile for CampusX, a clean lightweight Chinese university marketplace mini-program.
Create the NUMERICAL ELECTRONICS category (数码电子) asset only: a clear upright smartphone, a single phone with round-cornered body, simple screen, short top earpiece and small bottom home mark. No brand marks, no lettering, no unnecessary accessories.
STYLE: refined flat vector-like icon illustration, consistent rounded blue outline #005CC1, very pale blue and white interior fills, calm white-and-blue campus product UI. Primary palette #3B82F6 and #60A5FA. This is crisp 2D line art with an extremely subtle pastel background wash, not a glossy 3D emoji, not realistic product photography, not a clay render.
GEOMETRY: square 1024×1024 PNG canvas. One rounded-square backdrop from x=64,y=64 to x=960,y=960, uniform rounded corners about 190 px. Backdrop color is ice blue #E8F3FF with only a tiny softly blended #F3F8FF highlight. The rest of the canvas outside the rounded square MUST be actually transparent alpha, not white and not a rendered checkerboard. No outer drop shadow. The smartphone icon sits exactly centered, approximately 350 px wide ×560 px high, with uniform navy-blue strokes approximately 20 px, round caps and round joins. Empty space around the object is intentional for a light, friendly UI. The tile must read perfectly when displayed at 48–56 px, so use only essential details and moderate outline weight.
Output one isolated finished category tile only. NO text anywhere, no category label, no caption, no watermark, no surrounding page UI, no extra tiles. True transparent background outside the tile.
```
