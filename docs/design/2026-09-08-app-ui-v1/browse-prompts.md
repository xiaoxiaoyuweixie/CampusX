# 浏览与资源管理页面生成提示词

日期：2026-09-08。工具：内置 ImageGen。类型：高保真 PNG 视觉样板，未修改项目代码。全部商品、昵称、数字和日期为示例。

参考图：`../2026-09-08-home-detail-v1/home.png` 与 `../2026-09-08-home-detail-v1/product-detail.png`。仅继承视觉风格与商品示例。

## category.png

```text
Use case: ui-mockup. Create a polished high fidelity Chinese WeChat mini-program screen for CampusX (校易通), as the NEXT SCREEN in the precise same design system as the two reference PNGs. Reference image 1 is the approved home screen and image 2 the approved product detail. Inherit their visual style, clean Chinese sans-serif font, white and very pale blue surfaces, blue #3B82F6 accent, airy spacing, soft rounded white cards, thin line icons, red prices and warm natural product photography. DO NOT copy the home page layout or banner content. Output ONE single complete phone screen, portrait 864×1821 approximately, 390 logical px wide, native full-bleed screenshot, NO physical phone frame, no annotations, no page comparison or collage, no watermark. Top native iOS status row 9:41 and signal/WiFi/battery and beneath it native WeChat page title bar with right capsule menu. All Chinese text must be sharply rendered and exact. This is a visual design only; sample data. Preserve the existing feature scope and only render what is described below.
Page: 分类. Title bar centered “分类”, no back arrow because this is a main Tab page. Main page has a narrow 19% width vertical category sidebar on a very pale blue-gray surface, and a scrollable 81% width white content column. Sidebar categories in this exact order: 数码电子, 考研资料, 教材书籍, 技能服务, 宿舍用品. Use line icons matching the corresponding five reference home categories, in restrained pastel rounded-square backgrounds. “教材书籍” is selected, with blue icon/text, a soft blue rounded selection and a slim blue left accent. Other categories neutral.
At the top of the main column show a horizontal sort row “综合” (selected blue with short blue underline), “最新”, “价格” with tiny sort chevrons. Below show exactly THREE vertically stacked product cards. Each card is a wide landscape warm photoreal product image over white text panel, large rounded corners with subtle shadow, same typography as reference. Fit all three cards above TabBar by giving images moderate height. Card 1 image: exact reference sky-blue two-volume 高等数学 books on warm wood. Title “高等数学上下册”. Price “¥25”, location “荣昌校区”, seller “小林同学”, “128 浏览”. Card 2 photo: cream and light blue linear algebra textbook on sunny desk. Title “线性代数教材”. Price “¥15”, location “荣昌校区”, seller “陈同学”, “56 浏览”. Card 3 photo: English study textbook cream/navy cover on desk. Title “大学英语综合教程”. Price “¥20”, location “荣昌校区”, seller “小周”, “43 浏览”. Title, price, campus, seller and views are all readable. Nothing else in cards, no tags or buy buttons.
Bottom fixed five item native tab bar identical visual layout to approved reference: 首页, 分类, 发布, 消息, 我的. 分类 is blue selected with blue four-square icon; 首页 outline gray, 发布 blue outlined circle-plus but gray label, 消息 outline gray, 我的 outline gray. No AI floating button, no search bar, no promotional banner, no new functionality. Avoid empty unbalanced gaps.
```

## favorites.png

```text
Use case: ui-mockup. Create a polished high fidelity Chinese WeChat mini-program screen for CampusX (校易通), as the NEXT SCREEN in the precise same design system as the two reference PNGs. Reference image 1 is the approved home screen and image 2 the approved product detail. Inherit their visual style, clean Chinese sans-serif font, white and very pale blue surfaces, blue #3B82F6 accent, airy spacing, soft rounded white cards, thin line icons, red prices and warm natural product photography. DO NOT copy the home page layout or banner content. Output ONE single complete phone screen, portrait 864×1821 approximately, 390 logical px wide, native full-bleed screenshot, NO physical phone frame, no annotations, no page comparison or collage, no watermark. Top native iOS status row 9:41 and signal/WiFi/battery and beneath it native WeChat page title bar with right capsule menu. All Chinese text must be sharply rendered and exact. This is a visual design only; sample data. Preserve the existing feature scope and only render what is described below.
Page: 我的收藏, a secondary page. Title bar centered “我的收藏”, back chevron at left and native capsule at right. NO bottom navigation TabBar. Keep a bottom safe area with iOS home indicator.
Below title use a refined pale-blue summary card: left dark navy title “我的收藏”, subtext “已收藏资源”; right oversized blue “4” with small “条”, with subtle thin-line heart/book accent only, no promotional copy. Then a four-part horizontal filter “全部”, “商品”, “资料”, “服务”, selected “全部” uses soft blue pill and blue text. Below are exactly FOUR white rounded horizontal product cards, generous vertical spacing and consistent alignment. Each card has roughly square product photo at left (32% card width), title at top right, vivid red price below, gray campus/views below, seller text and a small warm-red subtle “♥ 已收藏” pill at bottom right. Do not overlap title and pill. Each card must expose the existing unfavorite control as “已收藏”. Data exact:
1 photo reference sky-blue 高等数学 two books on wood; title “高等数学上下册”; “¥25”; “荣昌校区 · 浏览 128”; “发布者：小林同学”; “已收藏”.
2 photo reference cream white headphones on wood; title “无线蓝牙耳机”; “¥89”; “荣昌校区 · 浏览 76”; “发布者：阿禾”; “已收藏”.
3 photo reference cream white lit desk lamp; title “宿舍护眼台灯”; “¥35”; “荣昌校区 · 浏览 62”; “发布者：小周”; “已收藏”.
4 photo reference navy student backpack; title “轻便双肩包”; “¥45”; “荣昌校区 · 浏览 48”; “发布者：小陈”; “已收藏”.
Balance screen vertical space so all 4 cards comfortably visible, realistic WeChat scale, modest bottom whitespace. No edit, share, bulk actions, checkout, extra statuses or new features. No decorative campus banner on this utility page.
```

## my-publish.png

```text
Use case: ui-mockup. Create a polished high fidelity Chinese WeChat mini-program screen for CampusX (校易通), as the NEXT SCREEN in the precise same design system as the two reference PNGs. Reference image 1 is the approved home screen and image 2 the approved product detail. Inherit their visual style, clean Chinese sans-serif font, white and very pale blue surfaces, blue #3B82F6 accent, airy spacing, soft rounded white cards, thin line icons, red prices and warm natural product photography. DO NOT copy the home page layout or banner content. Output ONE single complete phone screen, portrait 864×1821 approximately, 390 logical px wide, native full-bleed screenshot, NO physical phone frame, no annotations, no page comparison or collage, no watermark. Top native iOS status row 9:41 and signal/WiFi/battery and beneath it native WeChat page title bar with right capsule menu. All Chinese text must be sharply rendered and exact. This is a visual design only; sample data. Preserve the existing feature scope and only render what is described below.
Page: 我的发布, a secondary page. Center title “我的发布”, back chevron at left, native capsule right. NO bottom navigation TabBar. Bottom safe area and iOS home indicator.
Below title create a refined pale-blue summary card with dark navy heading “我发布的资源”, gray subheading “管理你在 CampusX 发布的全部内容”. Beneath this heading a single evenly spaced stat row: large blue 2 above “在售”; large muted gray 1 above “已下架”; large soft green 3 above “已售出”; subtle fine vertical dividers. After summary show a 3-part horizontal filter “在售” (selected blue pill or blue underline), “已下架”, “已售出”.
Show exactly TWO generous white rounded resource cards for selected 在售 state. Each card top body: square product image left 35%, right text with a title and small soft blue “在售” status chip, red price, muted “发布时间：2026-09-08”, and views / favorites. First product photo: sky-blue reference 高等数学 books on wood. Title “高等数学上下册”, “¥25”, “发布时间：2026-09-08”, “浏览 128 · 收藏 12”. Second product photo: reference white lit lamp on wood. Title “宿舍护眼台灯”, “¥35”, “发布时间：2026-09-07”, “浏览 62 · 收藏 5”.
Each card has a subtle horizontal divider below body, then right-aligned TWO buttons: small pale red “下架”, and pale green “标记已售出”. Both cards status is 在售 because 在售 filter selected. Make the action hierarchy quiet and legible, never giant green CTA. Do not display recovery button while 在售 selected, no edit/delete controls, no order/buy/payment functions. No extra publishing CTA for non-empty list. Do not show off-shelf or sold list cards mixed into selected 在售 view. All content fits complete screen with quiet breathing room under second card. No decorative campus banner.
```

## 分类定向修订

首图漏掉商品发布者，定向补齐；默认首图保留在生成目录中，项目内采用修订结果。

```text
Use case: precise-object-edit / ui-mockup. Edit this existing CampusX 分类 screen with ONE targeted correction: restore the missing seller-name field in EACH of the three product cards. Preserve the exact styling, colors, Chinese headings, navigation, five sidebar categories, 教材书籍 selection, 综合 sort selection, product titles, photos, prices, campuses, browsing counts, bottom five tabs and 分类 selected state. Do not redesign anything else. On each card, retain price, then campus on one line; below campus add a final metadata row with seller at left and existing browsing count at right, exactly as approved home product card convention. First card seller “小林同学” and “128 浏览”; second “陈同学” and “56 浏览”; third “小周” and “43 浏览”. To fit the added row for all three, slightly reduce the height of each product photo by about 35-45px while retaining their natural crop. Ensure the last card’s full seller/browsing row is ABOVE the fixed TabBar and not hidden. Seller text must be sharply legible in dark gray and all other content unchanged. Full-bleed native phone screenshot, no frame, no extra text, no watermark, same portrait dimensions.
```

## 默认生成源文件

- category.png：`/Users/mac172/.codex/generated_images/01a07fc8-b34f-7d21-8987-c5a2cc3f600b/exec-8576b68e-e0b7-4d19-9f1f-5c1f387f0128.png`
- favorites.png：`/Users/mac172/.codex/generated_images/01a07fc8-b34f-7d21-8987-c5a2cc3f600b/exec-7422f4e2-8800-4e69-b4c3-0e566fc2fb4c.png`
- my-publish.png：`/Users/mac172/.codex/generated_images/01a07fc8-b34f-7d21-8987-c5a2cc3f600b/exec-859d4183-1b23-4f46-b616-e49a1517d0f7.png`

原图均保留，交付副本位于当前目录。未进行位图拉伸或二次程序绘制。

