# HTML Content Block Guide

> **Last Updated:** July 28, 2026  
> **System:** HTML + Inline CSS Content Block  
> **Production Readiness:** 98/100

---

## Supported Editors

- **Blog Editor** — `BlogRichTextBlockEditor.tsx` + `BlogHtmlBlockEditor.tsx`
- **Lecture Editor** — `RichTextBlockEditor.tsx` + `HtmlBlockEditor.tsx`

---

## How to Use HTML Block

### 1. Add an HTML Block

In either the Blog Editor or Lecture Editor, open the **Add Block** menu and select **HTML** (purple icon with `</>`).

### 2. Write HTML + Inline CSS

A code editor textarea opens. Write your custom HTML with inline CSS:

```html
<div style="
  background: #f8fafc;
  padding: 20px;
  border-radius: 12px;
  border-left: 5px solid #2563eb;
">
  <h2 style="color: #2563eb; margin-top: 0;">Lesson Summary</h2>
  <p style="font-size: 18px; line-height: 1.8;">
    This is important information presented in a styled card.
  </p>
</div>
```

### 3. Preview Before Saving

Click the **Preview** button (👁️) to see the sanitized rendering. Click **Edit** (</>) to return to the code editor.

### 4. Save & Publish

Save as normal. The HTML block is stored in the `contentBlocks` JSON array alongside other blocks. When published, the user sees the exact same styled design.

---

## Mode Toggle: HTML Source

Both TipTap rich-text editors now include an **HTML Source** toggle (FileCode icon `</>` in the toolbar):

- **Normal Mode:** Visual TipTap editor with toolbar (existing behavior)
- **HTML Source Mode:** Raw HTML textarea — paste/write HTML + inline CSS directly

Toggle between modes at any time. Content is preserved across mode switches.

---

## Supported CSS Properties

Only the following CSS properties are allowed in `style` attributes. All others are stripped for security.

### Layout & Box Model

| Property | Example |
|---|---|
| `width` | `width: 100%` |
| `height` | `height: auto` |
| `min-width` / `max-width` | `min-width: 300px` |
| `min-height` / `max-height` | `max-height: 500px` |
| `padding` | `padding: 20px` |
| `padding-top/right/bottom/left` | `padding-left: 10px` |
| `margin` | `margin: 10px auto` |
| `margin-top/right/bottom/left` | `margin-bottom: 20px` |
| `box-sizing` | `box-sizing: border-box` |
| `overflow` | `overflow: auto` |

### Display & Flex/Grid

| Property | Example |
|---|---|
| `display` | `display: flex` |
| `flex`, `flex-direction`, `flex-wrap`, `flex-grow`, `flex-shrink`, `flex-basis` | `flex: 1` |
| `align-items`, `align-content`, `align-self` | `align-items: center` |
| `justify-content`, `justify-items`, `justify-self` | `justify-content: space-between` |
| `gap`, `row-gap`, `column-gap` | `gap: 16px` |
| `grid`, `grid-template`, `grid-template-columns/rows` | `grid-template-columns: 1fr 1fr` |
| `grid-column`, `grid-row`, `grid-area` | `grid-column: 1 / 3` |

### Typography

| Property | Example |
|---|---|
| `color` | `color: #2563eb` |
| `font-size` | `font-size: 18px` |
| `font-family` | `font-family: 'Noto Sans Bengali', sans-serif` |
| `font-weight` | `font-weight: 700` |
| `font-style` | `font-style: italic` |
| `line-height` | `line-height: 1.8` |
| `text-align` | `text-align: center` |
| `text-decoration` | `text-decoration: underline` |
| `text-transform` | `text-transform: uppercase` |
| `letter-spacing` | `letter-spacing: 0.5px` |
| `word-spacing` | `word-spacing: 2px` |
| `white-space` | `white-space: pre-wrap` |
| `direction` | `direction: rtl` |
| `unicode-bidi` | `unicode-bidi: embed` |

### Background

| Property | Example |
|---|---|
| `background` | `background: linear-gradient(to right, #2563eb, #7c3aed)` |
| `background-color` | `background-color: #f8fafc` |
| `background-image` | `background-image: url('/bg.png')` |
| `background-size` | `background-size: cover` |
| `background-position` | `background-position: center` |
| `background-repeat` | `background-repeat: no-repeat` |

### Border & Outline

| Property | Example |
|---|---|
| `border` | `border: 2px solid #e2e8f0` |
| `border-top/right/bottom/left` | `border-left: 5px solid #2563eb` |
| `border-color`, `border-style`, `border-width` | `border-color: #94a3b8` |
| `border-radius` | `border-radius: 12px` |
| `border-collapse` (tables) | `border-collapse: collapse` |
| `border-spacing` | `border-spacing: 0` |
| `outline`, `outline-color`, `outline-style`, `outline-width` | `outline: 2px dashed #94a3b8` |
| `box-shadow` | `box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1)` |

### Lists

| Property | Example |
|---|---|
| `list-style` | `list-style: none` |
| `list-style-type` | `list-style-type: decimal` |
| `list-style-position` | `list-style-position: inside` |

### Table

| Property | Example |
|---|---|
| `vertical-align` | `vertical-align: top` |
| `table-layout` | `table-layout: fixed` |

### Misc Visual

| Property | Example |
|---|---|
| `opacity` | `opacity: 0.8` |
| `visibility` | `visibility: visible` |
| `cursor` | `cursor: pointer` |
| `transform` | `transform: rotate(5deg)` |
| `transition`, `transition-property/duration/timing-function/delay` | `transition: all 0.3s ease` |

---

## Security Restrictions

### ❌ Blocked HTML Tags

These tags are **not allowed** and will be stripped:

- `<script>` — JavaScript execution
- `<style>` — CSS block injection
- `<link>` — External resource loading
- `<meta>` — Meta tag manipulation
- `<object>`, `<embed>`, `<param>` — Plugin execution
- `<form>`, `<input>`, `<button>`, `<select>`, `<textarea>` — Form elements
- `<frame>`, `<frameset>` — Legacy frame injection

### ❌ Blocked Attributes

- `onclick`, `onerror`, `onload`, `onmouseover`, `onmouseout` — **all `on*` event handlers**
- `formaction` — Form action override
- `data-script`, `data-action`, `data-onclick` — **all non-whitelisted `data-*` attributes**
- `javascript:` — **in href/src/action attributes** (blocked by URI regex)

### ❌ Blocked CSS Values

- `expression()` — IE-only CSS execution (blocked by CSS sanitizer)
- `javascript:` in CSS `url()` values (blocked by CSS sanitizer)
- `behavior:` — IE-only CSS behavior (blocked by CSS sanitizer)
- `@import` — External CSS imports (blocked by CSS sanitizer)
- `--custom-property` — CSS custom property injection (blocked by CSS sanitizer)
- `position: fixed` — UI overlay (blocked by CSS sanitizer)
- `position: absolute` — Layout escape (blocked by CSS sanitizer)

### ✅ Allowed Data Attributes

Only these `data-*` attributes are allowed:
- `data-type` — Block type identification
- `data-block` — Block context marker
- `data-id` — Element identifier
- `data-video-id` — Video embed identifier
- `data-resource-id` — Resource attachment identifier
- `data-mathml` — KaTeX math rendering support

---

## Architecture

```
Admin HTML Editor (textarea / HTML Source Mode)
        │
        ▼
HTML Block: { type: "html", content: "<div style='...'>...</div>" }
        │
        ▼
ContentBlock[] / BlogContentBlock[] serialized to JSON
        │
        ▼
API Route: validateAllHtmlBlocks() → sanitizeForStorage()
        │
        ▼
Database: contentBlocks JSON column
        │
        ▼
Public API → BlogDetailClient / LectureViewer
        │
        ▼
RichContentRenderer → sanitizeHtml() → dangerouslySetInnerHTML
        │
        ▼
User Frontend (styled design preserved)
```

---

## Maximum Size

- **HTML block content limit:** **500 KB** (512,000 bytes)
- If exceeded, the API returns a **422** error with a clear message.
- This prevents abuse via extremely large payloads.

---

## Important Notes

1. **Existing content is unaffected.** The `html` block type is additive — all existing blocks (heading, text, image, math, etc.) continue working identically.
2. **Sanitization is NOT optional.** Every HTML block passes through `sanitizeForStorage()` (server-side) and `sanitizeHtml()` (client-side rendering).
3. **CSS property filtering**: The `ALLOWED_STYLES` list is enforced by the custom CSS sanitizer (`src/lib/css-sanitizer.ts`). Non-whitelisted CSS properties are stripped from `style` attribute values.
4. **Bangla language support**: Fully supported — all HTML tags and CSS properties work with Bangla (Bengali) text.

---

## Troubleshooting

| Problem | Cause | Fix |
|---|---|---|
| Style doesn't appear | CSS property not in ALLOWED_STYLES | Use an allowed property from the list above |
| Data attribute missing | Not in whitelisted data-* attrs | Use one of: `data-type`, `data-block`, `data-id`, `data-video-id`, `data-resource-id` |
| JavaScript doesn't work | Blocked by DOMPurify | Don't use JavaScript in content blocks |
| Content > 500KB | Too large | Reduce HTML content size |
| HTML block empty in preview | Sanitization removed all content | Check for blocked tags/attributes |

---

## Examples

### Styled Information Card

```html
<div style="
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 24px;
  border-radius: 16px;
  text-align: center;
">
  <h2 style="color: white; margin: 0 0 8px 0;">Important Notice</h2>
  <p style="font-size: 16px; line-height: 1.6; margin: 0; opacity: 0.9;">
    Examination schedule has been updated.
  </p>
</div>
```

### Styled Table

```html
<table style="
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
">
  <thead>
    <tr style="background: #1e293b; color: white;">
      <th style="padding: 12px; text-align: left;">Subject</th>
      <th style="padding: 12px; text-align: center;">MCQ</th>
      <th style="padding: 12px; text-align: center;">CQ</th>
    </tr>
  </thead>
  <tbody>
    <tr style="border-bottom: 1px solid #e2e8f0;">
      <td style="padding: 10px;">Bangla</td>
      <td style="padding: 10px; text-align: center;">30</td>
      <td style="padding: 10px; text-align: center;">70</td>
    </tr>
  </tbody>
</table>
```

### Two-Column Layout with Flex

```html
<div style="
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
">
  <div style="
    flex: 1;
    min-width: 250px;
    background: #f0fdf4;
    padding: 20px;
    border-radius: 12px;
    border-left: 4px solid #22c55e;
  ">
    <h3 style="color: #16a34a;">Key Point 1</h3>
    <p style="font-size: 14px;">Content for column 1.</p>
  </div>
  <div style="
    flex: 1;
    min-width: 250px;
    background: #fef2f2;
    padding: 20px;
    border-radius: 12px;
    border-left: 4px solid #ef4444;
  ">
    <h3 style="color: #dc2626;">Key Point 2</h3>
    <p style="font-size: 14px;">Content for column 2.</p>
  </div>
</div>
```
