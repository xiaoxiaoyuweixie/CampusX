# 五类图标 · 无背景填充版

日期：2026-09-23。已去掉原图的彩色圆角底板和外围白底，保留手机、资料夹、教材、握手、台灯的蓝色轮廓与主体白色／浅蓝色填充。

| 分类 | 文件 |
| --- | --- |
| 数码电子 | 01-electronics.png |
| 考研资料 | 02-exam-materials.png |
| 教材书籍 | 03-textbooks.png |
| 技能服务 | 04-skill-services.png |
| 宿舍用品 | 05-dorm-essentials.png |

五张均为 1254 × 1254 的 RGBA PNG，可直接拖入 Figma 并叠放在自定义背景上。主体内部白色属于物体本身，不是背景。PNG 为位图，不是可编辑矢量。

使用内置 image_gen 基于原图编辑，原始素材位于 ../2026-09-22-category-components/；完整提示词见 edit-prompts.md。生成编辑保留了图形风格与主要细节，图形大小和少量边缘细节可能与原图有差异。

验证：逐张视觉检查背景移除与主体完整性；五张均含 alpha 通道，四角及四侧背景采样全部为 0。考研顶部挂环孔、台灯内部空白区域采样为 0。元数据见 alpha-check.json。

本次只新增设计素材，未修改小程序代码、未覆盖原图。

## 分类页接入记录

2026-09-23 按用户确认将上述素材接入分类页侧栏。设计原图继续保留；运行时图片等比例缩至 132 × 132，保留完整画布、图形颜色与 alpha 通道，不裁切、不增加背景。

| 设计原图 | 小程序资源 |
| --- | --- |
| 01-electronics.png | `miniprogram/images/category/category-digital.png` |
| 02-exam-materials.png | `miniprogram/images/category/category-kaoyan.png` |
| 03-textbooks.png | `miniprogram/images/category/category-book.png` |
| 04-skill-services.png | `miniprogram/images/category/category-skill.png` |
| 05-dorm-essentials.png | `miniprogram/images/category/category-dorm.png` |

侧栏沿用 64rpx 图标尺寸与 `#EFF6FF` 背景。首页继续使用 `miniprogram/images/home/` 中的原图。运行时五图共约 55 KiB，已核验 RGBA 通道及四角、四侧采样透明；真机显示待验。
