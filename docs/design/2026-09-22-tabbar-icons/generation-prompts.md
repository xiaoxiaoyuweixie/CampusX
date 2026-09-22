# CampusX 底部导航图标提示词

运行模式：Mode B · Host-Native，依据 gpt-image-2 技能的图标模板组织提示词，使用宿主原生图像工具。

依据：miniprogram/app.json、现有五个 tab 图标，以及 spec.md 的清爽校园风格。此次生成蓝色选中态；默认灰色规范为 #6B7280。所有图标为独立 PNG，不改应用代码。

## 首页

```json
{
  "type": "CampusX 小程序底部导航图标",
  "goal": "Create exactly ONE standalone high-fidelity UI icon asset, selected blue state, for a clean friendly campus marketplace mini-program. It must look like a crisp professional vector icon rendered as a PNG.",
  "theme": "校园小程序 · 清爽轻量 · 蓝色圆角线条",
  "use_case": "ui-mockup",
  "style": {
    "rendering": "Flat 2D monoline outline. Smooth round stroke caps and round joins. Geometrically clean, balanced and legible when reduced to 24px. No perspective or texture.",
    "material": "Solid opaque blue strokes only, smoothly antialiased edges.",
    "color_palette": "Single solid saturated campus blue #3B82F6; do not introduce other colors, gradients, or shading.",
    "shape_base": "Free-standing open glyph, no background tile.",
    "stroke": "Consistent 1.8 units stroke on a 24 by 24 design grid. All strokes have identical weight."
  },
  "layout": {
    "grid": "One square canvas containing one centered icon.",
    "icon_count": 1,
    "spacing": "Icon occupies approximately 70% of canvas width and height, with generous equal transparent safety margins. Optical centering.",
    "background": "TRUE fully transparent PNG alpha channel. Every area except the blue glyph strokes must have alpha zero, INCLUDING enclosed negative spaces inside the glyph. No white fill inside contours. Do NOT paint a checkerboard.",
    "label_below": false
  },
  "constraints": {
    "must_keep": [
      "Exactly one icon in the image",
      "Flat blue rounded outline styling",
      "Crisp smooth contours and spacious simple geometry",
      "Actual transparent background with no white matte and no white halo",
      "No text or labels"
    ],
    "avoid": [
      "white background",
      "white fill",
      "checkerboard pattern",
      "card or tile behind the icon",
      "pastel square",
      "shadow",
      "glow",
      "gradient",
      "3D bevel",
      "reflection",
      "multiple icons",
      "mockup",
      "watermark",
      "thin fragile details"
    ]
  },
  "icons": [
    {
      "id": 1,
      "concept": "One simple symmetrical house outline: pitched roof with gently rounded peak and rounded joins, two vertical wall sides and a base, one small centered doorway. No chimney, windows, dormers or extra details.",
      "label": "首页"
    }
  ],
  "text": "Render NO text, even though the concept label above names the icon."
}
```

## 分类

```json
{
  "type": "CampusX 小程序底部导航图标",
  "goal": "Create exactly ONE standalone high-fidelity UI icon asset, selected blue state, for a clean friendly campus marketplace mini-program. It must look like a crisp professional vector icon rendered as a PNG.",
  "theme": "校园小程序 · 清爽轻量 · 蓝色圆角线条",
  "use_case": "ui-mockup",
  "style": {
    "rendering": "Flat 2D monoline outline. Smooth round stroke caps and round joins. Geometrically clean, balanced and legible when reduced to 24px. No perspective or texture.",
    "material": "Solid opaque blue strokes only, smoothly antialiased edges.",
    "color_palette": "Single solid saturated campus blue #3B82F6; do not introduce other colors, gradients, or shading.",
    "shape_base": "Free-standing open glyph, no background tile.",
    "stroke": "Consistent 1.8 units stroke on a 24 by 24 design grid. All strokes have identical weight."
  },
  "layout": {
    "grid": "One square canvas containing one centered icon.",
    "icon_count": 1,
    "spacing": "Icon occupies approximately 70% of canvas width and height, with generous equal transparent safety margins. Optical centering.",
    "background": "TRUE fully transparent PNG alpha channel. Every area except the blue glyph strokes must have alpha zero, INCLUDING enclosed negative spaces inside the glyph. No white fill inside contours. Do NOT paint a checkerboard.",
    "label_below": false
  },
  "constraints": {
    "must_keep": [
      "Exactly one icon in the image",
      "Flat blue rounded outline styling",
      "Crisp smooth contours and spacious simple geometry",
      "Actual transparent background with no white matte and no white halo",
      "No text or labels"
    ],
    "avoid": [
      "white background",
      "white fill",
      "checkerboard pattern",
      "card or tile behind the icon",
      "pastel square",
      "shadow",
      "glow",
      "gradient",
      "3D bevel",
      "reflection",
      "multiple icons",
      "mockup",
      "watermark",
      "thin fragile details"
    ]
  },
  "icons": [
    {
      "id": 1,
      "concept": "Exactly four identical hollow rounded squares in an evenly spaced 2 by 2 grid. Same square sizes, identical corner radii, equal horizontal and vertical gaps.",
      "label": "分类"
    }
  ],
  "text": "Render NO text, even though the concept label above names the icon."
}
```

## 发布

```json
{
  "type": "CampusX 小程序底部导航图标",
  "goal": "Create exactly ONE standalone high-fidelity UI icon asset, selected blue state, for a clean friendly campus marketplace mini-program. It must look like a crisp professional vector icon rendered as a PNG.",
  "theme": "校园小程序 · 清爽轻量 · 蓝色圆角线条",
  "use_case": "ui-mockup",
  "style": {
    "rendering": "Flat 2D monoline outline. Smooth round stroke caps and round joins. Geometrically clean, balanced and legible when reduced to 24px. No perspective or texture.",
    "material": "Solid opaque blue strokes only, smoothly antialiased edges.",
    "color_palette": "Single solid saturated campus blue #3B82F6; do not introduce other colors, gradients, or shading.",
    "shape_base": "Free-standing open glyph, no background tile.",
    "stroke": "Consistent 1.8 units stroke on a 24 by 24 design grid. All strokes have identical weight."
  },
  "layout": {
    "grid": "One square canvas containing one centered icon.",
    "icon_count": 1,
    "spacing": "Icon occupies approximately 70% of canvas width and height, with generous equal transparent safety margins. Optical centering.",
    "background": "TRUE fully transparent PNG alpha channel. Every area except the blue glyph strokes must have alpha zero, INCLUDING enclosed negative spaces inside the glyph. No white fill inside contours. Do NOT paint a checkerboard.",
    "label_below": false
  },
  "constraints": {
    "must_keep": [
      "Exactly one icon in the image",
      "Flat blue rounded outline styling",
      "Crisp smooth contours and spacious simple geometry",
      "Actual transparent background with no white matte and no white halo",
      "No text or labels"
    ],
    "avoid": [
      "white background",
      "white fill",
      "checkerboard pattern",
      "card or tile behind the icon",
      "pastel square",
      "shadow",
      "glow",
      "gradient",
      "3D bevel",
      "reflection",
      "multiple icons",
      "mockup",
      "watermark",
      "thin fragile details"
    ]
  },
  "icons": [
    {
      "id": 1,
      "concept": "One perfect hollow circular ring with one centered plus sign inside. Plus arms of equal length with round caps; ample negative space between plus and circle. No raised button, filled disc, outer container or shadow.",
      "label": "发布"
    }
  ],
  "text": "Render NO text, even though the concept label above names the icon."
}
```

## 消息

```json
{
  "type": "CampusX 小程序底部导航图标",
  "goal": "Create exactly ONE standalone high-fidelity UI icon asset, selected blue state, for a clean friendly campus marketplace mini-program. It must look like a crisp professional vector icon rendered as a PNG.",
  "theme": "校园小程序 · 清爽轻量 · 蓝色圆角线条",
  "use_case": "ui-mockup",
  "style": {
    "rendering": "Flat 2D monoline outline. Smooth round stroke caps and round joins. Geometrically clean, balanced and legible when reduced to 24px. No perspective or texture.",
    "material": "Solid opaque blue strokes only, smoothly antialiased edges.",
    "color_palette": "Single solid saturated campus blue #3B82F6; do not introduce other colors, gradients, or shading.",
    "shape_base": "Free-standing open glyph, no background tile.",
    "stroke": "Consistent 1.8 units stroke on a 24 by 24 design grid. All strokes have identical weight."
  },
  "layout": {
    "grid": "One square canvas containing one centered icon.",
    "icon_count": 1,
    "spacing": "Icon occupies approximately 70% of canvas width and height, with generous equal transparent safety margins. Optical centering.",
    "background": "TRUE fully transparent PNG alpha channel. Every area except the blue glyph strokes must have alpha zero, INCLUDING enclosed negative spaces inside the glyph. No white fill inside contours. Do NOT paint a checkerboard.",
    "label_below": false
  },
  "constraints": {
    "must_keep": [
      "Exactly one icon in the image",
      "Flat blue rounded outline styling",
      "Crisp smooth contours and spacious simple geometry",
      "Actual transparent background with no white matte and no white halo",
      "No text or labels"
    ],
    "avoid": [
      "white background",
      "white fill",
      "checkerboard pattern",
      "card or tile behind the icon",
      "pastel square",
      "shadow",
      "glow",
      "gradient",
      "3D bevel",
      "reflection",
      "multiple icons",
      "mockup",
      "watermark",
      "thin fragile details"
    ]
  },
  "icons": [
    {
      "id": 1,
      "concept": "One wide rounded rectangular speech bubble outline, with a short integrated tail at bottom left. Exactly three equal solid circular dots evenly spaced on the horizontal center line. Tail is simple and graceful, outline stays connected.",
      "label": "消息"
    }
  ],
  "text": "Render NO text, even though the concept label above names the icon."
}
```

## 我的

```json
{
  "type": "CampusX 小程序底部导航图标",
  "goal": "Create exactly ONE standalone high-fidelity UI icon asset, selected blue state, for a clean friendly campus marketplace mini-program. It must look like a crisp professional vector icon rendered as a PNG.",
  "theme": "校园小程序 · 清爽轻量 · 蓝色圆角线条",
  "use_case": "ui-mockup",
  "style": {
    "rendering": "Flat 2D monoline outline. Smooth round stroke caps and round joins. Geometrically clean, balanced and legible when reduced to 24px. No perspective or texture.",
    "material": "Solid opaque blue strokes only, smoothly antialiased edges.",
    "color_palette": "Single solid saturated campus blue #3B82F6; do not introduce other colors, gradients, or shading.",
    "shape_base": "Free-standing open glyph, no background tile.",
    "stroke": "Consistent 1.8 units stroke on a 24 by 24 design grid. All strokes have identical weight."
  },
  "layout": {
    "grid": "One square canvas containing one centered icon.",
    "icon_count": 1,
    "spacing": "Icon occupies approximately 70% of canvas width and height, with generous equal transparent safety margins. Optical centering.",
    "background": "TRUE fully transparent PNG alpha channel. Every area except the blue glyph strokes must have alpha zero, INCLUDING enclosed negative spaces inside the glyph. No white fill inside contours. Do NOT paint a checkerboard.",
    "label_below": false
  },
  "constraints": {
    "must_keep": [
      "Exactly one icon in the image",
      "Flat blue rounded outline styling",
      "Crisp smooth contours and spacious simple geometry",
      "Actual transparent background with no white matte and no white halo",
      "No text or labels"
    ],
    "avoid": [
      "white background",
      "white fill",
      "checkerboard pattern",
      "card or tile behind the icon",
      "pastel square",
      "shadow",
      "glow",
      "gradient",
      "3D bevel",
      "reflection",
      "multiple icons",
      "mockup",
      "watermark",
      "thin fragile details"
    ]
  },
  "icons": [
    {
      "id": 1,
      "concept": "One simple profile silhouette in outline: a circular hollow head centered above a broad symmetric inverted-U shoulder arch that is open at the bottom. Clear gap between head and shoulders. No facial features, clothes, enclosing circle or badge.",
      "label": "我的"
    }
  ],
  "text": "Render NO text, even though the concept label above names the icon."
}
```
