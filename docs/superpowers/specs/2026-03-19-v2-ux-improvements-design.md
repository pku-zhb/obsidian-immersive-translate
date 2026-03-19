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
- **Complete**: Full bar + `"翻译完成 12/12"` + `Notice("翻译完成")`
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
| Error | partial | "翻译中断 3/12（出错）" | enabled | disabled if 0 translations |

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
  containerEl,
  sourcePath,  // for resolving wikilinks/images
  this.plugin
);
```

### Details

- Both original and translated blocks use `MarkdownRenderer.render()`
- `sourcePath` is the active file's path — ensures wikilinks resolve correctly
- For translated headings, render with `#` prefix so they display as headings
- The rendered output inherits the vault's current theme automatically
- Wrap each rendered block in a `<div>` with appropriate CSS class for spacing

## 3. Concurrent Translation

### Problem

Serial translation (one paragraph at a time) is slow for long documents.

### Solution

Replace the serial `for` loop with a bounded concurrency pool (max 3 concurrent requests).

### Algorithm

```
pool size = 3
pending = [all units]
active = []

while pending or active:
  fill active from pending up to pool size
  await Promise.race(active)
  remove completed from active
  update progress bar
  render completed unit
```

### Details

- **Concurrency**: 3 (hardcoded, no settings needed for v2)
- **Ordering**: Results rendered in original document order regardless of completion order. Pre-create all unit divs, fill in translations as they complete.
- **Error handling**: A failed paragraph records an error message in its slot, does not abort remaining translations. Progress label shows partial completion.
- **Progress update**: Each completion (success or failure) increments the counter and updates the progress bar.

### Pre-created DOM Structure

To maintain visual order with concurrent completion:
1. Before starting translations, create all unit `<div>`s with original text rendered
2. Each div has a placeholder for the translation
3. As translations complete (in any order), fill in the corresponding placeholder
4. This ensures the panel always shows paragraphs in document order

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

/* Markdown rendered content */
.immersive-translate-original,
.immersive-translate-translated {
  /* Reset Obsidian's default markdown spacing for inline preview */
}

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
| `styles.css` | Progress bar styles, rendered markdown adjustments |

## Testing

- Unit tests: Not applicable (all changes are Obsidian-API-dependent UI code)
- Manual testing:
  - Short note (2-3 paragraphs): verify progress shows and completes
  - Long note (15+ paragraphs): verify concurrency speedup, progress updates smoothly
  - Note with headings/lists/links: verify Markdown renders correctly
  - Network error mid-translation: verify partial progress and non-blocking behavior
