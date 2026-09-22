# 分类组件 · 透明背景版

当前状态：待清理边缘。图片工具已移除大块白色画布，但圆角边缘仍有白色毛边/零散残留；不作为最终交付。电子图另试一次精确圆角清边提示词后仍未消除，因此等待用户明确选择本地像素蒙版处理。

本版仅移除五张组件图外围的白色画布。浅色圆角底块、蓝色线条、图标内部白色与浅蓝色细节均应保留。

| 分类 | 透明 PNG |
| --- | --- |
| 数码电子 | [01-electronics.png](01-electronics.png) |
| 考研资料 | [02-exam-materials.png](02-exam-materials.png) |
| 教材书籍 | [03-textbooks.png](03-textbooks.png) |
| 技能服务 | [04-skill-services.png](04-skill-services.png) |
| 宿舍用品 | [05-dorm-essentials.png](05-dorm-essentials.png) |

可直接将 PNG 拖入 Figma，放在任意页面底色上。原来的白底版本仍保留在上一级目录。

处理方式：内置 image_gen 图片编辑；[完整编辑提示词](edit-prompts.md)。本次不修改小程序代码。

已完成只读目视核对：电子图与教材图的内部白色未被误删，主体图形没有严重变化。Alpha 通道基础检查见 [alpha-check.json](alpha-check.json)，该检查不代表毛边已通过验收。
