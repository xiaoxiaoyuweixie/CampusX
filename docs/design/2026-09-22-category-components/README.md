# 五类分类入口组件图

沿用 CampusX 清爽、轻量的校园风格：圆角蓝色线条、浅色圆角底块、白色画布。每类单独提供 PNG，方便导入 Figma。

五张均为 1254×1254 的 RGB PNG（白底，不含透明通道），没有烧录分类名称。完整下载包：[category-components.zip](category-components.zip)。

| 分类 | 图片 | 图形 |
| --- | --- | --- |
| 数码电子 | [01-electronics.png](01-electronics.png) | 手机 |
| 考研资料 | [02-exam-materials.png](02-exam-materials.png) | 备考资料夹与勾选标记 |
| 教材书籍 | [03-textbooks.png](03-textbooks.png) | 三本叠放教材 |
| 技能服务 | [04-skill-services.png](04-skill-services.png) | 握手 |
| 宿舍用品 | [05-dorm-essentials.png](05-dorm-essentials.png) | 台灯 |

## 放入 Figma

- 将每张图片放进相同尺寸的 Frame，建议先按 56×56 px 预览，并通过等比缩放统一可见底块大小。
- 名称单独新建 Text 图层：13 px、颜色 `#374151`、居中，与图片间距 4–6 px。
- 将图片与名称放入纵向 Auto Layout；五项再组成等分横排。
- PNG 为位图素材。名称可单独编辑，图形内部线条不属于可编辑矢量。
- 白色画布适配当前白色分类栏；图片等比缩放，不拉伸。

## 生成记录

使用内置 image_gen，未修改小程序代码或替换线上素材。

- [基准图提示词](generation-prompts.md)
- [最终五图提示词](final-prompts.md)

## 检查结果

- 五个 PNG 均可读取，尺寸一致。
- 已目视核对五张图：蓝色圆角线条与浅色底块协调；手机、资料夹、叠放教材、握手和台灯可辨识。
- 分类文案独立于图片，便于后续在 Figma 中修改字号与名称。
- 图片为生成素材，具体线条颜色与尺寸仍需在正式设计稿中按目标显示大小校准；不将生成图视为精确的矢量组件。
