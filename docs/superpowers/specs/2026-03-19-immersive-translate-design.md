# Obsidian Immersive Translate - Design Spec

## Overview

An Obsidian plugin inspired by Chrome's Immersive Translate and Feishu's inline translation. Provides bilingual reading experience by translating note content paragraph-by-paragraph and displaying results in a side panel, with the option to insert translations directly into the source file.

## Core User Flow

1. User opens a note containing foreign language content
2. User triggers translation via `Cmd+P` command or opens the translation panel directly
3. A side panel opens on the right, with two buttons: **Translate** and **Insert into Note**
4. User clicks **Translate** → paragraphs are translated one by one and displayed in the panel (original + translation alternating)
5. User reviews the result in the panel
6. If satisfied, clicks **Insert into Note** → translations are written into the source `.md` file after each corresponding original paragraph
7. Panel remains open; user closes it manually when done
8. If not satisfied, user simply closes the panel — nothing changes

## Architecture

Four core modules:

### 1. Translation Engine Layer (`src/engine/`)

Pluggable interface for translation backends.

```typescript
interface TranslationEngine {
  name: string
  translate(text: string, from: string, to: string): Promise<string>
}
```

**First release:** Google Translate (free, no API key required, using unofficial API).

**Extensibility:** Engine registry via simple Map. Adding new engines (DeepL, LLM, etc.) requires only implementing the interface and registering.

### 2. Paragraph Parser (`src/parser.ts`)

Reads note content and splits it into translation units by Markdown paragraphs (separated by blank lines).

**Rules:**
- Skip: frontmatter (`---`), code blocks (`` ``` ``), images, HTML tags
- Preserve: Markdown syntax markers (list bullets, heading `#`, blockquote `>`) — translate inner text only
- Translate: headings (text portion), regular paragraphs, list blocks, blockquote text

**Example input:**
```markdown
---
title: My Note
---

# Introduction

This is the first paragraph about machine learning.

- Point one about neural networks
- Point two about training data
```

**Parsed units:** 3 — heading "Introduction", body paragraph, list block. Frontmatter skipped.

### 3. Preview Panel (`src/view.ts`)

Custom `ItemView` rendered in the right sidebar leaf.

**Layout:**
- Top bar: **Translate** button + **Insert into Note** button
- Body: original and translated paragraphs alternating, plain text rendering
- During translation: paragraphs appear progressively (one by one as each completes)

**Behavior:**
- Panel can be opened independently and stays open until user closes it
- Translate button triggers translation of the currently active note
- Insert button writes translations into the source file
- Panel remains open after insertion

### 4. Inserter (`src/inserter.ts`)

Writes translated paragraphs into the source `.md` file.

**Logic:**
- For each translated paragraph, insert the translation after the corresponding original paragraph
- Separate original and translation with a blank line (standard Markdown paragraph separation)
- Auto-save file after insertion

**Example result:**
```markdown
# Introduction
# 介绍

This is the first paragraph about machine learning.

这是关于机器学习的第一段。

- Point one about neural networks
- Point two about training data

- 关于神经网络的第一点
- 关于训练数据的第二点
```

## Settings (`src/settings.ts`)

- **Source language**: dropdown, default "English"
- **Target language**: dropdown, default "Chinese (Simplified)"
- **Translation engine**: dropdown (for future extensibility, currently only Google Translate)

## Project Structure

```
obsidian-immersive-translate/
├── src/
│   ├── main.ts              # Plugin entry, register commands and views
│   ├── settings.ts           # Settings tab (language, engine config)
│   ├── engine/
│   │   ├── types.ts          # TranslationEngine interface
│   │   └── google.ts         # Google Translate implementation
│   ├── parser.ts             # Paragraph parser
│   ├── view.ts               # Preview panel (ItemView)
│   └── inserter.ts           # Translation inserter
├── styles.css
├── manifest.json
├── package.json
└── tsconfig.json
```

## Technical Details

- **Language:** TypeScript
- **Build tool:** esbuild (Obsidian official recommendation)
- **Minimum Obsidian version:** 1.0.0

## Scope Boundaries (Out of Scope for v1)

- Selected text translation (full note only)
- LLM-based translation engines
- DeepL integration
- Sentence-level granularity
- Translation caching
- Custom styling for translated text
