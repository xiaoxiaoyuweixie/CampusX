请在 CampusX 小程序中，将「我的」页面菜单里的五个 emoji 图标替换为已经生成好的 PNG 图片，直接完成代码修改和必要验证。

一、先检查现有实现
先阅读项目 AGENTS.md、spec.md，检查 git status --short，再读取「我的」页面相关源码。保留当前工作区已有改动。
目前已核对 /Users/mac172/Desktop/opd/CampusX/miniprogram/pages/profile/index.wxml 中，五个菜单项使用 text.m-icon 展示 emoji，点击事件为 onMenuTap；对应样式位于 /Users/mac172/Desktop/opd/CampusX/miniprogram/pages/profile/index.wxss。
如果你的开发任务使用独立工作目录，请修改该目录中的对应源码；以下素材绝对路径是原始图片来源，不要求切换或覆盖其他工作目录。

二、图片与菜单对应关系
请直接读取以下已经生成的图片，不重新设计或生成：
- 我的发布，data-action="published"：/Users/mac172/Desktop/opd/CampusX/docs/design/2026-09-24-profile-menu-icons/01-my-posts.png
- 我的收藏，data-action="favorites"：/Users/mac172/Desktop/opd/CampusX/docs/design/2026-09-24-profile-menu-icons/02-favorites.png
- 联系方式，data-action="contacts"：/Users/mac172/Desktop/opd/CampusX/docs/design/2026-09-24-profile-menu-icons/03-contact.png
- 设置，data-action="settings"：/Users/mac172/Desktop/opd/CampusX/docs/design/2026-09-24-profile-menu-icons/04-settings.png
- 关于我们，data-action="about"：/Users/mac172/Desktop/opd/CampusX/docs/design/2026-09-24-profile-menu-icons/05-about.png

素材说明：/Users/mac172/Desktop/opd/CampusX/docs/design/2026-09-24-profile-menu-icons/README.md
透明度及可见主体范围：/Users/mac172/Desktop/opd/CampusX/docs/design/2026-09-24-profile-menu-icons/alpha-check.json

三、运行时素材准备
五张原图均为 1254×1254 的透明 PNG，透明留白不同，不宜直接按相同尺寸缩小后使用。
请保留原始设计文件，从原图生成适合菜单显示的本地 PNG 资源。允许使用本地图像处理工具裁掉多余透明边距、等比缩放、补齐透明画布及压缩；不重绘、不改变颜色和主体造型。
建议输出统一的 96×96 透明 PNG，可见主体最长边约 80px，主体居中并按视觉重量微调。参考 alpha-check.json 的有效主体范围，保留抗锯齿边缘，避免被极低透明度的散点影响裁切范围；不要按“白色”直接去底，以免误删白色信息标识或高光。关于我们图标的蓝色圆角方块属于主体，必须保留。
将优化后的五张资源放入当前小程序源码的本地图片目录，可新建 images/profile-menu 子目录，保持清楚的对应文件名。仅将优化后的运行时资源加入小程序包，不把设计原图、ZIP 或提示词目录复制进包；页面不能引用电脑绝对路径、docs 目录、远程临时链接或 Base64。

四、页面替换与视觉要求
把五个 text.m-icon 改成微信原生 image 组件，使用本地资源路径和 mode="aspectFit"，明确宽高、禁止压缩，居中对齐。
建议图标容器统一为 40rpx × 40rpx，并结合现有行高和字重微调，保证纸箱、星星、电话、齿轮和信息徽章的视觉大小协调。不要因为原图透明留白不同而出现纸箱明显偏小的问题。
更新原有 .m-icon 的文字样式为图片所需样式，保持五行文字起点一致、图标与文字间距一致，图标不拉伸、不裁断、不挤压右侧箭头。
保留现有菜单名称、顺序、整行点击区域、data-action、onMenuTap 和跳转行为。此次修改范围是「我的」页面这五个菜单图标及对应本地资源；保留头像、统计卡片、底部 TabBar、页面其他样式和业务逻辑。

五、验证与交付
执行最小有效验证：
1. 确认五项与图片一一对应，运行时路径有效，五个 emoji 已从对应菜单图标节点中移除。
2. 检查输出 PNG 尺寸、透明通道和文件体积；确认主体没有拉伸、白底或裁切缺损。
3. 使用可用的微信开发者工具或现有预览方式检查「我的」页面，核对大小、对齐、清晰度、整行点击与跳转。能提供实际预览截图时请附上。
4. 如果无法使用微信开发者工具或真机，应明确已完成的静态检查和未验证项，不把静态检查表述为真机通过。

完成后简短说明修改文件、图片优化前后的体积、最终显示尺寸和验证结果。
