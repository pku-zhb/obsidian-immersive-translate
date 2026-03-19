# V2 UX Improvements Design

## Overview

Three focused improvements to the translate panel UX:
1. Progress indicator — visible without scrolling
2. Markdown rendering — using Obsidian's native renderer
3. Concurrent translation — bounded parallelism for speed

All changes are scoped to `src/view.ts` and `styles.css`. No changes to parser, inserter, engine, settings, or main.

## 1. Progress Indicator

### Problem

After clicking Translate, the user must scroll to the bottom of the panel to confirm whether all paragraphs have been translated.

### Solution

Add a progress bar below the toolbar (top-fixed, always visible):

- **Idle**: Hidden
- **Translating**: `<progress>` element + text label `"翻译中 3/12"`
- **Complete**: Full bar + `"翻译完成 12/12"`
- **Error**: `"翻译中断 3/12（出错）"` — bar stays at current progress

### Implementation

```
toolbar
progress-area          ← new: contains <progress> + <span>
  <progress max=12 value=3>
  <span>翻译中 3/12</span>
content-body (scrollable)
```

Use native `<progress>` HTML element — inherits Obsidian theme via CSS variables.

### UI States

| State | Progress bar | Label | Translate btn | Insert btn |
|---|---|---|---|---|
| Idle | hidden | hidden | enabled | disabled |
| Translating | animated | "翻译中 3/12" | disabled | disabled |
| Complete | full | "翻译完成 12/12" | enabled | enabled |
| Error | partial | "翻译中断 3/12（出错）" | enabled | enabled if any translations succeeded |
| Zero units | hidden | hidden | enabled (re-enabled) | disabled |

Note: When `parseParagraphs` returns an empty array, progress bar stays hidden (early return with Notice, same as v1).

## 2. Markdown Rendering

### Problem

Panel shows raw Markdown text — headings, lists, links display as plain strings without formatting.

### Solution

Replace `createDiv({ text: ... })` with Obsidian's `MarkdownRenderer.render()` for both original and translated content.

### API

```typescript
await MarkdownRenderer.render(
  this.app,
  markdownText,
  containerEl,  // empty <div> — render() appends into this element
  sourcePath,   // for resolving wikilinks/images
  this.plugin
);
```

### Details

- Both original and translated blocks use `MarkdownRenderer.render()`
- `MarkdownRenderer.render()` appends rendered HTML into the provided container element. For each block, create an empty `<div>` and pass it as `containerEl`. Do NOT use `innerHTML` or `textContent` assignment.
- `sourcePath` is the active file's path — ensures wikilinks resolve correctly
- For translated headings: the `#` prefix is already part of the display text (v1 prepends it). `MarkdownRenderer.render()` will render it as a proper heading element. Original headings already have `#` in `unit.raw`, so both render symmetrically as headings.
- The rendered output inherits the vault's current theme automatically
- No cancellation/abort mechanism for v2 — in-flight requests complete silently if panel closes (same gap as v1, acceptable)

## 3. Concurrent Translation

### Problem

Serial translation (one paragraph at a time) is slow for long documents.

### Solution

Replace the serial `for` loop with a bounded concurrency pool (max 3 concurrent requests).

### Concurrency Constant

```typescript
const CONCURRENCY = 3;  // top of view.ts
```

### Algorithm

```
pool size = CONCURRENCY
pending = [all units]
active = []

while pending or active:
  fill active from pending up to pool size
  await Promise.race(active)
  remove completed from active
  update progress bar
  render completed unit
```

### Critical: translations[] Array Contract

The inserter (`buildInsertedContent`) expects `translations[i]` to correspond to `units[i]`. With concurrent completion in arbitrary order:

- **Use indexed assignment**: `translations[i] = translated` — NOT `push()`
- **Pre-allocate**: `const translations: (string | null)[] = new Array(units.length).fill(null)`
- **On success**: `translations[i] = translatedText`
- **On failure**: `translations[i] = null` — this slot is skipped during insert

### Insert with Failed Paragraphs

When the user clicks Insert, filter out failed (null) paragraphs:

```typescript
// Before calling buildInsertedContent:
const successUnits = units.filter((_, i) => translations[i] !== null);
const successTranslations = translations.filter((t) => t !== null) as string[];
buildInsertedContent(content, successUnits, successTranslations);
```

This ensures failed paragraphs are simply not inserted — no garbled output, no blank lines.

### Pre-created DOM Structure

To maintain visual order with concurrent completion:
1. Before starting translations, create all unit `<div>`s with original text rendered via `MarkdownRenderer.render()`
2. Each unit div contains an empty `<div class="immersive-translate-translated">` as a placeholder
3. As translations complete (in any order), call `MarkdownRenderer.render()` into the corresponding placeholder div
4. This ensures the panel always shows paragraphs in document order

### Error Handling

- A failed paragraph: render error text in its placeholder (e.g., styled error message), set `translations[i] = null`
- Does NOT abort remaining translations
- Progress counter increments on both success and failure
- Insert button enabled if at least one translation succeeded

## CSS Changes

```css
/* Progress area */
.immersive-translate-progress {
  padding: 8px 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.immersive-translate-progress progress {
  flex: 1;
  height: 6px;
}

.immersive-translate-progress .progress-label {
  font-size: 12px;
  color: var(--text-muted);
  white-space: nowrap;
}

/* Markdown rendered content — use Obsidian defaults, no reset needed */
.immersive-translate-translated {
  opacity: 0.85;
  border-left: 2px solid var(--interactive-accent);
  padding-left: 8px;
}
```

## Files Changed

| File | Changes |
|---|---|
| `src/view.ts` | Progress bar UI, MarkdownRenderer.render(), concurrency pool |
| `styles.css` | Progress bar styles, translated block accent border |

## Testing

- Unit tests: Not applicable (all changes are Obsidian-API-dependent UI code)
- Manual testing:
  - Short note (2-3 paragraphs): verify progress shows and completes
  - Long note (15+ paragraphs): verify concurrency speedup, progress updates smoothly
  - Note with headings/lists/links: verify Markdown renders correctly
  - Network error mid-translation: verify partial progress, Insert still works for successful paragraphs
  - Empty/no-translatable-content note: verify progress bar stays hidden
