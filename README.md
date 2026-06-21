# CampusX / 校易通 - 微信小程序 MVP

面向大学生（首期：西南大学）的校园资源共享与信息发布微信小程序。原生小程序实现，纯前端 Mock 数据，方便后续上传 GitHub 并由 Cursor 继续迭代。

## ✨ 功能（MVP）

- 🏠 **首页**：学校定位、搜索框、Banner、5 大分类入口、推荐资源
- 🗂️ **分类页**：左侧分类 + 右侧列表，支持「综合 / 最新 / 价格」简单排序
- ➕ **发布页**：图片、标题、分类、价格、面交地点、描述 → 一键发布
- 📄 **详情页**：图片轮播、价格、描述、面交信息、发布者、收藏、联系
- 💬 **消息页**：系统通知 + 私信列表
- 💌 **聊天页**：本地消息发送（Mock，无真实 WebSocket）
- 👤 **我的**：头像、昵称、学校认证、我的发布/收藏、设置、关于

只保留 5 个分类：**数码电子 / 教材书籍 / 考研资料 / 宿舍用品 / 技能服务**。

> 不含支付、订单、担保交易、跑腿履约、AI 估价等复杂功能 — 仅展示信息，由双方线下面交。

## 🚀 本地运行

1. 下载并安装 [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
2. 打开开发者工具 → 导入项目 → 选择本仓库的 `miniprogram/` 目录
3. AppID 选「测试号」即可（`project.config.json` 中默认 `touristappid`）
4. 编译运行

### TabBar 图标

`app.json` 中引用了 `miniprogram/images/tab-*.png`。仓库未附带图标，请自行准备或在开发者工具中暂时使用纯文字 TabBar（删除 `iconPath` / `selectedIconPath` 字段即可显示）。

## 📁 目录结构

```
miniprogram/
├── app.js / app.json / app.wxss      # 全局入口与配置
├── sitemap.json
├── project.config.json
├── pages/
│   ├── home/         # 首页
│   ├── category/     # 分类
│   ├── publish/      # 发布
│   ├── detail/       # 详情
│   ├── message/      # 消息列表
│   ├── chat/         # 聊天
│   └── profile/      # 我的
├── components/
│   ├── product-card/ # 资源卡片
│   ├── search-bar/   # 搜索框
│   └── empty-state/  # 空状态
├── mock/
│   ├── products.js   # 资源/分类 Mock
│   ├── messages.js   # 消息 Mock
│   └── user.js
├── utils/
│   ├── storage.js    # 本地存储 & 收藏
│   └── router.js     # 跳转辅助
└── images/           # TabBar 图标占位
```

## 🎨 设计规范

- 主色 `#3B82F6`，辅助 `#60A5FA`，背景 `#F8FAFC`
- 文字主 `#111827`，副 `#6B7280`
- 卡片式布局、圆角、轻阴影，清爽校园感
- 按 375px 宽度移动端设计；避开胶囊按钮；底部 TabBar 不遮挡内容

## 🛠️ 后续可扩展（不在 MVP）

支付 / 订单 / 真实 IM / 担保交易 / 信用分 / AI 估价 / 推荐算法 — 后续版本再做。

## 📝 License

MIT
