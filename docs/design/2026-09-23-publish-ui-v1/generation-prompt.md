# 发布页视觉优化示例 v1

日期：2026-09-23。

运行方式：gpt-image-2 技能 Mode B / Host-Native，通过内置 image_gen 出图。

参考图：用户提供的当前发布页截图。模板：ui-mockups/social-interface-mockup.md 的单屏移动 UI 结构，按 prompt-writing.md 改为发布表单。

本次只生成设计示例，不修改应用代码。保持原有字段与业务含义，优化上传区、文字层级、表单分组和发布按钮。

```json
{
  "type": "校园资源小程序发布页 · 高保真 UI 改版示例",
  "goal": "基于输入截图生成一张经过专业视觉设计的发布页示例图。保留当前页面全部字段与业务含义，只优化视觉层级、间距、卡片、图标和按钮。结果像精致的真实移动端界面截图。",
  "input_image": {
    "role": "当前真实页面，作为功能、内容与蓝白风格参考；允许重新排版和优化视觉，不需逐像素复刻。"
  },
  "platform": {
    "name": "CampusX 校园资源微信小程序",
    "color_mode": "light",
    "language": "简体中文"
  },
  "canvas": {
    "format": "One single straight-on portrait mobile UI screen, approximately 390:844 aspect ratio, high resolution. Edge-to-edge interface screenshot without any device hardware or surrounding presentation board.",
    "logical_size": "390 × 844 px"
  },
  "header": {
    "status_bar": "Small tidy iOS-style status bar with time 9:41, signal, Wi-Fi and battery. Background very pale icy blue.",
    "navigation": "Centered title 发布资源. Right side retains the familiar WeChat mini-program white capsule with ellipsis and circular close icon. No back button because this is a top-level tab.",
    "intro": "Compact left-aligned heading 让校园资源流动起来 in dark navy 20px semibold, then one subtle 12px line 好物、资料与技能，都值得被发现. No large illustration or banner."
  },
  "layout": {
    "horizontal_margin": "16 logical pixels",
    "spacing": "12px gaps between main white cards; 16px padding inside cards; consistent baseline alignment.",
    "vertical_plan": "At logical 390x844: status 0–28, navbar 28–72, compact intro 86–125, photo card 139–297, basic-information card 309–547, description card 559–693, publish action 707–767, bottom tabs 777–829, safe area 829–844. Adapt slightly for optical balance but fit the whole interface naturally in one screen.",
    "photo_card": {
      "header_left": "图片",
      "header_right": "0/9",
      "header_style": "15px semibold dark title, 12px muted counter",
      "upload_area": "A wide, refined pale-blue upload well inside the white card, rounded 14px corners with a subtle blue dashed outline. It spans the available card width and is about 105px tall. Center a 26px rounded blue outline camera-plus icon, then the blue action text 添加图片 and a muted 11px helper 最多上传 9 张，实拍图更清晰. No uploaded photos yet. No grid of 9 empty boxes."
    },
    "information_card": {
      "design": "One unified white card with 4 rows. Each row has a fixed 60px left label column, aligned fields on the right, and extremely subtle #F0F3F8 separators. Text-first, avoid an extra decorative icon on every row.",
      "rows": [
        {
          "label": "标题",
          "content": "请输入标题，简明扼要",
          "state": "muted placeholder",
          "height": "58px"
        },
        {
          "label": "分类",
          "content": "数码电子",
          "state": "dark selected text, small elegant downward chevron at far right",
          "height": "54px"
        },
        {
          "label": "价格",
          "content": "¥  请输入价格",
          "state": "currency symbol in blue, placeholder neutral gray; slightly more spacious row",
          "height": "66px"
        },
        {
          "label": "面交",
          "content": "如：荣昌校区 · E栋门口",
          "state": "muted text input placeholder, NO right arrow or location-selection button",
          "height": "60px"
        }
      ]
    },
    "description_card": {
      "title": "描述",
      "placeholder": "说说成色、用法、转让原因～",
      "design": "15px semibold title, then a roomy 14px muted placeholder in an empty multiline field. Compact but comfortable approximately 134px card height. No hard border nested inside the card, no fake character limit, no extra chips or helper buttons."
    }
  },
  "footer": {
    "publish_action": "A full-width primary blue button with 16px horizontal margins, 50px height, 16px rounded corners. Strong #3B82F6 blue with a restrained very subtle lighter upper edge and soft blue shadow; centered white bold text 发布. It sits in a quiet bottom action area directly above the tabs, with comfortable separation.",
    "navigation_bar": "White tab bar, top hairline, five evenly spaced items 首页、分类、发布、消息、我的. Use a consistent family of simple 22px rounded outline icons: house, 2x2 rounded squares, circled plus, speech bubble, profile. 发布 alone is active blue #3B82F6; other four are muted gray #8A94A6. Small labels beneath. No elevated central button or bubble backgrounds; keep native-style equal sizing.",
    "safe_area": "White safe area with one subtle black iOS home indicator."
  },
  "style": {
    "rendering": "Premium, crisp, calm high-fidelity mobile app UI. Realistic polished Figma quality, not a poster. Thoughtful information hierarchy and precise typography. The actual form remains the main focus.",
    "palette": "Primary #3B82F6; secondary #60A5FA; page #F4F7FC with very subtle pale blue near header; cards #FFFFFF; primary text #17233B; labels #344054; readable placeholders #8994A6; separators #F0F3F8.",
    "geometry": "Consistent 18px card corner radii, 14–16px controls, delicate 1px borders where necessary. Nearly flat white cards with only the faintest diffuse shadow. No harsh strokes.",
    "typography": "Modern Chinese sans-serif similar to PingFang SC. Use real legible simplified Chinese. Field labels 14–15px medium, input content 14px, section titles 15px semibold, heading 20px semibold, bottom labels 10px. No calligraphy.",
    "mood": "清爽、轻盈、亲切、校园感。Blue accents are purposeful and restrained. Generous but efficient whitespace."
  },
  "constraints": {
    "must_keep": [
      "全部五个底部tab，发布为选中态",
      "图片最多9张，标题、分类、价格、面交、描述、发布按钮都出现",
      "字段为空的初始发布状态，分类值为数码电子",
      "所有文字准确清晰，完整显示所有主要内容",
      "One screen only; no annotations, measurements, before/after, arrows pointing to the UI or explanatory design captions"
    ],
    "avoid": [
      "改变业务流程",
      "新增AI生成、保存草稿、成色标签、议价、物流、定位或隐私选项",
      "新增没根据的字段限制或必填星号",
      "密集的小图标",
      "粗重阴影",
      "玻璃拟态",
      "3D浮雕控件",
      "过大装饰插画",
      "庞大空白描述框",
      "窄小的发布按钮",
      "营销海报构图",
      "手机外壳或倾斜透视",
      "英文标题",
      "截断底部内容"
    ]
  }
}
```
