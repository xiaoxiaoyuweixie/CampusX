# 分类图标透明背景编辑

目标：去掉五张图的彩色圆角底板和外围白底，保留图标主体及其原有填色。使用内置 image_gen 编辑，每张传入对应原图。

## 数码电子

原图：/Users/mac172/Desktop/opd/CampusX/docs/design/2026-09-22-category-components/01-electronics.png

```text
Use case: background-extraction.
Edit the supplied image. Create the transparent version of this exact existing CampusX category icon.
Input image 1 is the edit target, NOT merely a style reference.
KEEP: the blue-outlined smartphone, including its pale screen reflection, white body surround, top speaker and circular home button. The screen and physical phone body remain filled; only the area outside the complete phone silhouette becomes transparent.
REMOVE completely: the large pastel rounded-square tile behind the object, the entire white outer canvas, all background-colored fill and any background shadow. Replace them with genuine zero-alpha transparency. The rounded-square tile MUST NOT remain, even faintly.
Preserve the subject's exact existing silhouette, original deep blue hue, rounded line thickness, internal object colors, proportions, position, size, and square canvas. Do not redraw into a new icon, add new strokes, simplify, shift, scale or crop the subject. The intended result is the identical central object, cleanly isolated.
Output a transparent RGBA PNG with smooth antialiased subject edges, no white fringe, no colored background halo, no checkerboard pixels, no new ground or container, no text. White or pale blue fill physically belonging to the object is NOT background and must be retained. Preserve clean empty alpha outside the object and in the specified open holes.
There is exactly one icon. Do NOT output a before/after comparison.
```

## 考研资料

原图：/Users/mac172/Desktop/opd/CampusX/docs/design/2026-09-22-category-components/02-exam-materials.png

```text
Use case: background-extraction.
Edit the supplied image. Create the transparent version of this exact existing CampusX category icon.
Input image 1 is the edit target, NOT merely a style reference.
KEEP: the blue-outlined clipboard and stacked study sheets, the clip, horizontal lines and check mark. The paper and rectangular clip surfaces keep their existing white/pale-blue fill. The hole in the circular loop ABOVE the clip must become transparent because it shows the removed mint background.
REMOVE completely: the large pastel rounded-square tile behind the object, the entire white outer canvas, all background-colored fill and any background shadow. Replace them with genuine zero-alpha transparency. The rounded-square tile MUST NOT remain, even faintly.
Preserve the subject's exact existing silhouette, original deep blue hue, rounded line thickness, internal object colors, proportions, position, size, and square canvas. Do not redraw into a new icon, add new strokes, simplify, shift, scale or crop the subject. The intended result is the identical central object, cleanly isolated.
Output a transparent RGBA PNG with smooth antialiased subject edges, no white fringe, no colored background halo, no checkerboard pixels, no new ground or container, no text. White or pale blue fill physically belonging to the object is NOT background and must be retained. Preserve clean empty alpha outside the object and in the specified open holes.
There is exactly one icon. Do NOT output a before/after comparison.
```

## 教材书籍

原图：/Users/mac172/Desktop/opd/CampusX/docs/design/2026-09-22-category-components/03-textbooks.png

```text
Use case: background-extraction.
Edit the supplied image. Create the transparent version of this exact existing CampusX category icon.
Input image 1 is the edit target, NOT merely a style reference.
KEEP: the three stacked blue-outlined textbooks and bookmark. Preserve the pale blue covers and white page blocks, book overlap and all existing line details. Only the space outside the book stack silhouette becomes transparent.
REMOVE completely: the large pastel rounded-square tile behind the object, the entire white outer canvas, all background-colored fill and any background shadow. Replace them with genuine zero-alpha transparency. The rounded-square tile MUST NOT remain, even faintly.
Preserve the subject's exact existing silhouette, original deep blue hue, rounded line thickness, internal object colors, proportions, position, size, and square canvas. Do not redraw into a new icon, add new strokes, simplify, shift, scale or crop the subject. The intended result is the identical central object, cleanly isolated.
Output a transparent RGBA PNG with smooth antialiased subject edges, no white fringe, no colored background halo, no checkerboard pixels, no new ground or container, no text. White or pale blue fill physically belonging to the object is NOT background and must be retained. Preserve clean empty alpha outside the object and in the specified open holes.
There is exactly one icon. Do NOT output a before/after comparison.
```

## 技能服务

原图：/Users/mac172/Desktop/opd/CampusX/docs/design/2026-09-22-category-components/04-skill-services.png

```text
Use case: background-extraction.
Edit the supplied image. Create the transparent version of this exact existing CampusX category icon.
Input image 1 is the edit target, NOT merely a style reference.
KEEP: the two shaking hands and sleeves. Preserve their blue outlines, white hand surfaces, light-blue cuff interiors and finger geometry. Everything outside the handshake silhouette becomes transparent.
REMOVE completely: the large pastel rounded-square tile behind the object, the entire white outer canvas, all background-colored fill and any background shadow. Replace them with genuine zero-alpha transparency. The rounded-square tile MUST NOT remain, even faintly.
Preserve the subject's exact existing silhouette, original deep blue hue, rounded line thickness, internal object colors, proportions, position, size, and square canvas. Do not redraw into a new icon, add new strokes, simplify, shift, scale or crop the subject. The intended result is the identical central object, cleanly isolated.
Output a transparent RGBA PNG with smooth antialiased subject edges, no white fringe, no colored background halo, no checkerboard pixels, no new ground or container, no text. White or pale blue fill physically belonging to the object is NOT background and must be retained. Preserve clean empty alpha outside the object and in the specified open holes.
There is exactly one icon. Do NOT output a before/after comparison.
```

## 宿舍用品

原图：/Users/mac172/Desktop/opd/CampusX/docs/design/2026-09-22-category-components/05-dorm-essentials.png

```text
Use case: background-extraction.
Edit the supplied image. Create the transparent version of this exact existing CampusX category icon.
Input image 1 is the edit target, NOT merely a style reference.
KEEP: the blue-outlined desk lamp including shade, stand and base. Preserve white/pale-blue physical surfaces of shade, inner shade opening, curved stem and base. All open spaces around the lamp and inside the tiny on/off switch loop above the base must become transparent, as these show the removed lavender background.
REMOVE completely: the large pastel rounded-square tile behind the object, the entire white outer canvas, all background-colored fill and any background shadow. Replace them with genuine zero-alpha transparency. The rounded-square tile MUST NOT remain, even faintly.
Preserve the subject's exact existing silhouette, original deep blue hue, rounded line thickness, internal object colors, proportions, position, size, and square canvas. Do not redraw into a new icon, add new strokes, simplify, shift, scale or crop the subject. The intended result is the identical central object, cleanly isolated.
Output a transparent RGBA PNG with smooth antialiased subject edges, no white fringe, no colored background halo, no checkerboard pixels, no new ground or container, no text. White or pale blue fill physically belonging to the object is NOT background and must be retained. Preserve clean empty alpha outside the object and in the specified open holes.
There is exactly one icon. Do NOT output a before/after comparison.
```
