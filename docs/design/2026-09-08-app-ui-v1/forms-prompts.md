# 发布与联系方式页：ImageGen 提示词

日期：2026-09-08。使用内置 ImageGen，3 次独立页面生成与 2 次定向修订，共 5 次调用；未使用 CLI/API 回退。

参考图：[已确认首页](../2026-09-08-home-detail-v1/home.png)、[已确认商品详情](../2026-09-08-home-detail-v1/product-detail.png)。先读取相关页面 WXML/WXSS/JS、页面 JSON、app.json 和 spec.md，再生成静态视觉稿。

## publish 初稿

```text
Use case: ui-mockup. Create ONE polished high-fidelity mobile WeChat mini-program UI screenshot for CampusX / 校易通. Input images 1 and 2 are STYLE REFERENCES ONLY, the already approved homepage and product-detail. Inherit their exact visual family: bright white, airy pale blue #EFF6FF / #F8FAFC canvas, primary blue #3B82F6, near-black #111827, subdued gray #6B7280, very faint shadows, 12px logical rounded corners, clean thin rounded outline icons, Chinese PingFang SC style. No emoji. Produce a flat full-bleed single portrait screenshot around 864×1821 pixels, no device frame, no surrounding board or annotations or watermark. Normal readable mobile typography, clear consistent 16px logical side margins and 4/8px spacing system. Top standard phone status bar 9:41 with signal/wifi/battery and WeChat navbar with right ellipsis/circle capsule. Chinese text must be exact and sharp. Only explicitly specified UI, no added slogans, badges, checkout, shipping, payments, unsupported assurances or new functions.
PAGE: 发布资源. Navbar centered exact title "发布资源", no back arrow (root Tab page). Show a polished filled-out publish form for the SAME illustrative light sky-blue fine-line-math-cover two-volume book in the detail reference. Logical layout is 390px wide and approximately 820px high.
Under navbar, light off-white background with three well-spaced white rounded cards. Card 1: exact heading "图片（最多 9 张）"; one square photo thumbnail of the reference book on oak desk with a small dark circular "×" delete control top right. Beside it an equal square pale-blue upload tile with outlined plus and exact "添加图片". Keep clean breathing room.
Card 2: four full-width field rows separated by fine neutral hairlines. Exact labels and values: "标题" / "高等数学上下册"; "分类" / "教材书籍" with small down chevron; "价格" / "¥25"; "面交" / "荣昌校区 · 图书馆门口". Values align neatly, labels visually secondary but readable. These are editable fields, no stepper, tags or additional fields.
Card 3: exact heading "描述" then two lines/short paragraphs in a spacious textarea area: "上下两册，少量铅笔笔记，不影响阅读。" and "课程结束后转让，希望交给需要的同学。". No word count, tips, added character limits, or extra actions. Keep total form in comfortable first-screen layout.
At bottom a separate white action area contains a large blue rounded button exact "发布"; below this action area, a distinct fixed white 5-item TabBar EXACT "首页", "分类", "发布", "消息", "我的". 发布 active blue, all other tabs gray; each has consistent outline icons, 发布 a modest circle-plus. Button and TabBar MUST be fully visible, spaced and non-overlapping. Safe area and small home indicator bottom. Do not render keyboard. Match the product reference photograph and visual style closely, no campus hero needed on a utility form. Output only this one screenshot.
```

## contacts 初稿

```text
Use case: ui-mockup. Create ONE polished high-fidelity mobile WeChat mini-program UI screenshot for CampusX / 校易通. Input images 1 and 2 are STYLE REFERENCES ONLY, the already approved homepage and product-detail. Inherit their exact visual family: bright white, airy pale blue #EFF6FF / #F8FAFC canvas, primary blue #3B82F6, near-black #111827, subdued gray #6B7280, very faint shadows, 12px logical rounded corners, clean thin rounded outline icons, Chinese PingFang SC style. No emoji. Produce a flat full-bleed single portrait screenshot around 864×1821 pixels, no device frame, no surrounding board or annotations or watermark. Normal readable mobile typography, clear consistent 16px logical side margins and 4/8px spacing system. Top standard phone status bar 9:41 with signal/wifi/battery and WeChat navbar with right ellipsis/circle capsule. Chinese text must be exact and sharp. Only explicitly specified UI, no added slogans, badges, checkout, shipping, payments, unsupported assurances or new functions.
PAGE: 联系方式. Navbar centered exact title "联系方式", back chevron on left, capsule on right. It is a secondary settings page: no bottom TabBar.
Below navbar, a compact pale-blue notice panel with tiny outline info icon and exact text, comfortable 3-4 lines: "微信和手机信息用于其他用户直接联系你时使用，若不希望提供可关闭，关闭后所有功能均不会向其他用户展示该信息。" This is EXISTING product copy, preserve exactly and do not add any other privacy/safety promise.
Next two white rounded contact cards on extremely pale blue-gray background. Card 1 has left a small blue outlined chat icon on pale-blue rounded square, exact heading "微信"; at far right a clearly ON blue switch with white knob on right. Fine divider below. Lower row exact label "微信号", value "campusx_demo", and small outlined button exact "修改号码". Ensure each string is legible and no overflow. This is a clearly illustrative identifier, do not create QR.
Card 2 left small blue-gray outlined phone icon on pale-blue square, exact heading "手机"; at far right clearly OFF gray switch with white knob on LEFT. Because phone is OFF, show NO lower number row, NO placeholder phone, NO modify button for phone, no extra disabled text.
Allow generous calm empty space below these two compact cards; settings page does not need filling. No bottom action, no promotional illustration, no tabs, no new text labels. Bottom home indicator. Style must clearly belong to the provided homepage and detail UI family. Output only this one screenshot.
```

## contact-edit 初稿

```text
Use case: ui-mockup. Create ONE polished high-fidelity mobile WeChat mini-program UI screenshot for CampusX / 校易通. Input images 1 and 2 are STYLE REFERENCES ONLY, the already approved homepage and product-detail. Inherit their exact visual family: bright white, airy pale blue #EFF6FF / #F8FAFC canvas, primary blue #3B82F6, near-black #111827, subdued gray #6B7280, very faint shadows, 12px logical rounded corners, clean thin rounded outline icons, Chinese PingFang SC style. No emoji. Produce a flat full-bleed single portrait screenshot around 864×1821 pixels, no device frame, no surrounding board or annotations or watermark. Normal readable mobile typography, clear consistent 16px logical side margins and 4/8px spacing system. Top standard phone status bar 9:41 with signal/wifi/battery and WeChat navbar with right ellipsis/circle capsule. Chinese text must be exact and sharp. Only explicitly specified UI, no added slogans, badges, checkout, shipping, payments, unsupported assurances or new functions.
PAGE: 联系方式 with the existing edit-wechat bottom sheet OPEN, keyboard hidden before focus. Navbar centered exact title "联系方式", left back chevron, right WeChat capsule. Background screen shows pale-blue notice with exact existing copy "微信和手机信息用于其他用户直接联系你时使用，若不希望提供可关闭，关闭后所有功能均不会向其他用户展示该信息。", then a 微信 contact card ON with value campusx_demo and 修改号码, then 手机 card OFF with no phone details. A neutral semi-transparent dark gray overlay covers the whole underlying page, making it naturally dim but still recognizable.
Bottom-aligned white sheet, large rounded upper corners, occupying roughly the bottom 32% of screen, ample bottom safe area. In the sheet header at left semibold exact title "设置微信号" and at upper right an accessible gray "×" close control. Below exact field label "微信号", then one wide pale-gray input with clear fine blue focus-style border, text "campusx_demo". Below it centered medium-wide blue rounded button with exact text "确定". These are the ONLY sheet texts. No subtitle, no help paragraph, no privacy slogan, no cancel button, no "保存", no added field, no QR. No keyboard and no bottom TabBar, this is a secondary page. Bottom home indicator on the white sheet. Match exact input, button, typography, and visual language of the approved reference. Output only this one screenshot.
```

## contact-edit 定向修订

```text
Use case: compositing / precise UI edit. Image 1 is the EXACT BACKGROUND PAGE to use. Image 2 is ONLY the WHITE BOTTOM SHEET reference.
Create a 864×1821 screenshot showing the Image 1 联系方式 page with its bottom-sheet editor open. Preserve Image 1 completely unchanged in the entire background: exact same header and notice with blue info icon, same blue LINE chat icon and heading 微信 (NOT 微信号), same separate lower row 微信号 / campusx_demo / outlined 修改号码 button, same 手机 heading and OFF switch with nothing else in phone card. DO NOT use any background layout or icons from Image 2. Dim this exact Image 1 background with a neutral semi-transparent overlay.
Add precisely the WHITE BOTTOM SHEET from Image 2 over the lower 36%: rounded upper corners, title 设置微信号, right ×, label 微信号, wide pale-blue bordered input campusx_demo, blue button 确定, and bottom home indicator. The text input is not focused: remove the blue caret because the keyboard is hidden. No other content changes. No added 未提供 text, no 微信 logo, no 手机号码 heading, no TabBar, no new actions. Keep Image 1 dimensions 864×1821. Produce only the finished screenshot, crisp Chinese.
```

## publish 定向修订

```text
Use case: ui-mockup / precise reformatting. Image 1 is the EDIT TARGET: a correct CampusX 发布资源 screen. Image 2 shows ONLY the target 864×1821 canvas dimensions and same app design family.
Return Image 1 reformatted to EXACTLY 864×1821 pixels, a tall phone screen with ratio approx 1:2.108, matching Image 2's image dimensions. Preserve ALL content, text and buttons of Image 1, its photo, field order, typography family, blue theme, white cards, rounded corners. Do not change business content. Reflow scale/vertical spacing tastefully to fill the taller screen. Keep comfortable 16px logical side margins, 3 form cards, separate blue 发布 action area, and five bottom tabs 首页 分类 发布 消息 我的 with 发布 blue. Bottom action and TabBar fully visible without overlap. Add safe-area home indicator at very bottom under tab labels. Keep all exact texts as in Image 1: 发布资源; 图片（最多 9 张）; 添加图片; 标题; 高等数学上下册; 分类; 教材书籍; 价格; ¥25; 面交; 荣昌校区 · 图书馆门口; 描述; 上下两册，少量铅笔笔记，不影响阅读。; 课程结束后转让，希望交给需要的同学。; 发布. Keep photo of sky-blue two-volume maths textbook, x control. Do not add or remove fields, labels, actions or tips. No keyboard, no back arrow on root tab page. Output only finished screenshot.
```

## 最终原图路径

- 发布：`/Users/mac172/.codex/generated_images/01a07fc9-5980-76d0-ae6d-c46694b1dda9/exec-4fee596b-996a-4ff6-9a43-0e27ade8f31e.png`
- 联系方式：`/Users/mac172/.codex/generated_images/01a07fc9-5980-76d0-ae6d-c46694b1dda9/exec-c6e2382a-5fd8-4f97-af91-81fdaa6ee93f.png`
- 联系方式编辑：`/Users/mac172/.codex/generated_images/01a07fc9-5980-76d0-ae6d-c46694b1dda9/exec-cac6c39c-44a4-4fb3-9d95-785e0460a40f.png`

默认原图均保留，交付图片已复制至本目录。

