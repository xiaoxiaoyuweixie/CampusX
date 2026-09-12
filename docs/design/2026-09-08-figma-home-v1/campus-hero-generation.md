# 校园插画素材生成记录

用途：首页 Figma 高保真试稿中的独立校园横幅图片。

交付文件：[campus-hero.png](campus-hero.png)，1942×809，PNG。

目视检查：无界面文字或控件残留；保留右侧钟楼、建筑、树木和浅蓝天空，左侧留白可叠放原生文字。建筑细节与原图存在 AI 还原差异。仅新增设计素材及说明，未修改开发代码。

编辑方式：内置 image_gen 图片工具，以已确认的 [首页图](../2026-09-08-home-detail-v1/home.png) 为编辑参考，去除文字和控件并补全背景。此素材为 AI 编辑还原，不能视为逐像素裁切原图。

在 Figma 中将图片置于首页横幅的底层，标题、学校、搜索框独立叠放。等比填充并调整裁切焦点，禁止拉伸。

## 使用的完整提示词

```text
Use case: precise-object-edit / background-extraction.
Asset type: standalone clean campus illustration banner for the approved CampusX homepage in Figma.
Input image 1 is the EDIT TARGET: the approved homepage mockup. Extract and restore ONLY its pale blue campus hero illustration, originally approximately x=0,y=166,w=864,h=389, above the category panel. Deliver one clean landscape PNG banner, approximately 1536×640 (wide 2.4:1), with no UI and no typography.
Preserve the same elegant semi-realistic illustrated campus architecture visible on the right: pale gray modern low university building, the distinct central square clock tower, dark window grids, lush green trees and lawns, large leafy branches entering from the upper right, pale cyan sky and soft wispy clouds. Preserve the recognizable architecture, viewpoint, lighting, color palette and pleasant sunny mood as closely as possible; do not design a different campus or invent extra towers. The building and landscape belong on the RIGHT HALF, and the LEFT HALF must remain mostly open pale blue sky, blending softly into the illustration like the reference so that editable Chinese headlines can later be layered over it in Figma. Keep entire clock tower and trees visible, with ground along the lower edge. Use the source illustration as faithfully as possible; only restore artwork hidden by overlaid interface elements and the rounded content card. Remove every element of the application interface: status bar, navigation title, capsule, school name, pin, search field, hero headline, subtitle, categories, cards, buttons, borders, and their shadows. The artwork itself should fill the rectangular canvas edge to edge. No rounded UI mask, no margins or presentation board, no watermark, no lettering, no labels, no phones, no text of any kind. Background should be opaque pale blue sky, NOT checkerboard or white cutout. Output a clean reusable illustration image, not a webpage screenshot.
```
