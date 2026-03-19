# Obsidian Immersive Translate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an Obsidian plugin that translates notes paragraph-by-paragraph via Google Translate and displays bilingual results in a side panel, with an option to insert translations into the source file.

**Architecture:** Four modules — translation engine (pluggable, Google Translate first), paragraph parser (splits Markdown into translatable units), preview panel (ItemView with Translate/Insert buttons), and inserter (writes translations into the source file). Data flows: user triggers command → parser extracts paragraphs → engine translates → panel displays → user optionally inserts into source.

**Tech Stack:** TypeScript, Obsidian Plugin API, esbuild, `google-translate-api-x` (unofficial Google Translate wrapper)

**Spec:** `docs/superpowers/specs/2026-03-19-immersive-translate-design.md`

---

## File Structure

| File | Responsibility |
|------|---------------|
| `src/main.ts` | Plugin entry point. Registers commands, view, settings tab. |
| `src/settings.ts` | Settings tab UI + PluginSettings interface (source/target language, engine). |
| `src/engine/types.ts` | `TranslationEngine` interface + `TranslationResult` type. |
| `src/engine/google.ts` | Google Translate implementation using `google-translate-api-x`. |
| `src/parser.ts` | Splits Markdown content into `ParagraphUnit[]` — typed blocks (heading, paragraph, list, etc.) with positions. |
| `src/view.ts` | `TranslateView` extending `ItemView`. Renders panel with Translate/Insert buttons and bilingual content. |
| `src/inserter.ts` | Takes translation results and inserts them into the active editor after corresponding original paragraphs. |
| `styles.css` | Minimal panel styling (button bar, spacing). |
| `manifest.json` | Obsidian plugin manifest (id, name, version, minAppVersion). |
| `package.json` | Dependencies and build scripts. |
| `tsconfig.json` | TypeScript config targeting ES2018, ESM modules. |
| `esbuild.config.mjs` | esbuild build script for bundling the plugin. |
| `.gitignore` | Ignore node_modules, main.js, etc. |

Test files:
| File | Tests |
|------|-------|
| `tests/parser.test.ts` | Paragraph parsing: splitting, skipping frontmatter/code/math/tables, heading extraction, list handling. |
| `tests/inserter.test.ts` | Translation insertion: correct positions, heading/paragraph/list insertion, idempotency edge cases. |
| `tests/engine/google.test.ts` | Google Translate engine: API call, error handling. |

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`, `tsconfig.json`, `esbuild.config.mjs`, `manifest.json`, `.gitignore`, `styles.css`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "obsidian-immersive-translate",
  "version": "0.1.0",
  "description": "Immersive bilingual translation for Obsidian notes",
  "main": "main.js",
  "scripts": {
    "dev": "node esbuild.config.mjs",
    "build": "node esbuild.config.mjs production",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "esbuild": "^0.21.0",
    "obsidian": "latest",
    "typescript": "^5.4.0",
    "vitest": "^1.6.0"
  },
  "dependencies": {
    "google-translate-api-x": "^10.7.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "inlineSourceMap": true,
    "inlineSources": true,
    "module": "ESNext",
    "target": "ES2018",
    "allowJs": true,
    "noImplicitAny": true,
    "moduleResolution": "node",
    "importHelpers": true,
    "isolatedModules": true,
    "strictNullChecks": true,
    "lib": ["DOM", "ES2018", "ES2021.String"]
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Create esbuild.config.mjs**

```javascript
import esbuild from "esbuild";
import process from "process";

const prod = process.argv[2] === "production";

esbuild.build({
  entryPoints: ["src/main.ts"],
  bundle: true,
  external: ["obsidian", "electron", "@codemirror/state", "@codemirror/view"],
  format: "cjs",
  target: "es2018",
  logLevel: "info",
  sourcemap: prod ? false : "inline",
  treeShaking: true,
  outfile: "main.js",
  platform: "node",
}).catch(() => process.exit(1));
```

- [ ] **Step 4: Create manifest.json**

```json
{
  "id": "obsidian-immersive-translate",
  "name": "Immersive Translate",
  "version": "0.1.0",
  "minAppVersion": "1.0.0",
  "description": "Immersive bilingual translation for Obsidian notes",
  "author": "",
  "isDesktopOnly": true
}
```

- [ ] **Step 5: Create .gitignore**

```
node_modules/
main.js
*.js.map
data.json
```

- [ ] **Step 6: Create styles.css**

```css
.immersive-translate-container {
  padding: 10px;
}

.immersive-translate-toolbar {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--background-modifier-border);
}

.immersive-translate-toolbar button {
  flex: 1;
}

.immersive-translate-unit {
  margin-bottom: 16px;
}

.immersive-translate-original {
  margin-bottom: 4px;
}

.immersive-translate-translated {
  margin-bottom: 4px;
  opacity: 0.85;
}
```

- [ ] **Step 7: Install dependencies**

Run: `bun install`
Expected: `node_modules/` created, lockfile generated.

- [ ] **Step 8: Commit**

```bash
git add package.json tsconfig.json esbuild.config.mjs manifest.json .gitignore styles.css bun.lockb
git commit -m "chore: 初始化 Obsidian 插件项目脚手架"
```

---

### Task 2: Translation Engine Interface + Google Translate

**Files:**
- Create: `src/engine/types.ts`, `src/engine/google.ts`, `tests/engine/google.test.ts`

- [ ] **Step 1: Write the engine interface**

Create `src/engine/types.ts`:

```typescript
export interface TranslationEngine {
  name: string;
  translate(text: string, from: string, to: string): Promise<string>;
}
```

- [ ] **Step 2: Write failing test for Google Translate engine**

Create `tests/engine/google.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";

// We'll mock the google-translate-api-x module to avoid real API calls
vi.mock("google-translate-api-x", () => ({
  default: vi.fn(),
}));

import translate from "google-translate-api-x";
import { GoogleTranslateEngine } from "../../src/engine/google";

describe("GoogleTranslateEngine", () => {
  it("has the correct name", () => {
    const engine = new GoogleTranslateEngine();
    expect(engine.name).toBe("Google Translate");
  });

  it("translates text using google-translate-api-x", async () => {
    const mockTranslate = vi.mocked(translate);
    mockTranslate.mockResolvedValueOnce({ text: "你好世界" } as any);

    const engine = new GoogleTranslateEngine();
    const result = await engine.translate("Hello world", "en", "zh-CN");

    expect(result).toBe("你好世界");
    expect(mockTranslate).toHaveBeenCalledWith("Hello world", {
      from: "en",
      to: "zh-CN",
    });
  });

  it("passes 'auto' as source language for auto-detect", async () => {
    const mockTranslate = vi.mocked(translate);
    mockTranslate.mockResolvedValueOnce({ text: "你好" } as any);

    const engine = new GoogleTranslateEngine();
    await engine.translate("Hello", "auto", "zh-CN");

    expect(mockTranslate).toHaveBeenCalledWith("Hello", {
      from: "auto",
      to: "zh-CN",
    });
  });

  it("throws on API failure", async () => {
    const mockTranslate = vi.mocked(translate);
    mockTranslate.mockRejectedValueOnce(new Error("Network error"));

    const engine = new GoogleTranslateEngine();
    await expect(engine.translate("Hello", "en", "zh-CN")).rejects.toThrow(
      "Network error"
    );
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `bun run test -- tests/engine/google.test.ts`
Expected: FAIL — `GoogleTranslateEngine` not found.

- [ ] **Step 4: Implement Google Translate engine**

Create `src/engine/google.ts`:

```typescript
import translate from "google-translate-api-x";
import type { TranslationEngine } from "./types";

export class GoogleTranslateEngine implements TranslationEngine {
  name = "Google Translate";

  async translate(text: string, from: string, to: string): Promise<string> {
    const result = await translate(text, { from, to });
    return result.text;
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `bun run test -- tests/engine/google.test.ts`
Expected: All 4 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/engine/types.ts src/engine/google.ts tests/engine/google.test.ts
git commit -m "feat: 添加翻译引擎接口和 Google Translate 实现"
```

---

### Task 3: Paragraph Parser

**Files:**
- Create: `src/parser.ts`, `tests/parser.test.ts`

- [ ] **Step 1: Write failing tests for paragraph parser**

Create `tests/parser.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { parseParagraphs, ParagraphUnit } from "../src/parser";

describe("parseParagraphs", () => {
  it("splits plain text into paragraphs by blank lines", () => {
    const input = "First paragraph.\n\nSecond paragraph.";
    const result = parseParagraphs(input);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      type: "paragraph",
      raw: "First paragraph.",
      text: "First paragraph.",
      lineStart: 0,
      lineEnd: 0,
    });
    expect(result[1]).toEqual({
      type: "paragraph",
      raw: "Second paragraph.",
      text: "Second paragraph.",
      lineStart: 2,
      lineEnd: 2,
    });
  });

  it("skips frontmatter", () => {
    const input = "---\ntitle: Test\n---\n\nActual content.";
    const result = parseParagraphs(input);
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe("Actual content.");
  });

  it("skips code blocks", () => {
    const input =
      "Before code.\n\n```python\nprint('hello')\n```\n\nAfter code.";
    const result = parseParagraphs(input);
    expect(result).toHaveLength(2);
    expect(result[0].text).toBe("Before code.");
    expect(result[1].text).toBe("After code.");
  });

  it("skips math blocks", () => {
    const input = "Before math.\n\n$$\nE = mc^2\n$$\n\nAfter math.";
    const result = parseParagraphs(input);
    expect(result).toHaveLength(2);
    expect(result[0].text).toBe("Before math.");
    expect(result[1].text).toBe("After math.");
  });

  it("skips tables", () => {
    const input =
      "Before table.\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n\nAfter table.";
    const result = parseParagraphs(input);
    expect(result).toHaveLength(2);
    expect(result[0].text).toBe("Before table.");
    expect(result[1].text).toBe("After table.");
  });

  it("skips callouts", () => {
    const input = "Before.\n\n> [!note]\n> This is a callout.\n\nAfter.";
    const result = parseParagraphs(input);
    expect(result).toHaveLength(2);
    expect(result[0].text).toBe("Before.");
    expect(result[1].text).toBe("After.");
  });

  it("skips image lines", () => {
    const input = "Before.\n\n![alt](image.png)\n\nAfter.";
    const result = parseParagraphs(input);
    expect(result).toHaveLength(2);
    expect(result[0].text).toBe("Before.");
    expect(result[1].text).toBe("After.");
  });

  it("skips embeds", () => {
    const input = "Before.\n\n![[other-note]]\n\nAfter.";
    const result = parseParagraphs(input);
    expect(result).toHaveLength(2);
    expect(result[0].text).toBe("Before.");
    expect(result[1].text).toBe("After.");
  });

  it("parses headings with type heading", () => {
    const input = "# Introduction\n\nSome text.";
    const result = parseParagraphs(input);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      type: "heading",
      raw: "# Introduction",
      text: "Introduction",
    });
  });

  it("parses list blocks as a single unit", () => {
    const input =
      "Before.\n\n- Item one\n- Item two\n- Item three\n\nAfter.";
    const result = parseParagraphs(input);
    expect(result).toHaveLength(3);
    expect(result[1]).toMatchObject({
      type: "list",
      raw: "- Item one\n- Item two\n- Item three",
      text: "- Item one\n- Item two\n- Item three",
    });
  });

  it("parses ordered list blocks", () => {
    const input = "Before.\n\n1. First\n2. Second\n\nAfter.";
    const result = parseParagraphs(input);
    expect(result).toHaveLength(3);
    expect(result[1].type).toBe("list");
  });

  it("returns empty array for empty input", () => {
    expect(parseParagraphs("")).toEqual([]);
    expect(parseParagraphs("---\ntitle: X\n---")).toEqual([]);
  });

  it("skips HTML blocks", () => {
    const input = "Before.\n\n<div>some html</div>\n\nAfter.";
    const result = parseParagraphs(input);
    expect(result).toHaveLength(2);
    expect(result[0].text).toBe("Before.");
    expect(result[1].text).toBe("After.");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test -- tests/parser.test.ts`
Expected: FAIL — `parseParagraphs` not found.

- [ ] **Step 3: Implement paragraph parser**

Create `src/parser.ts`:

```typescript
export type UnitType = "paragraph" | "heading" | "list";

export interface ParagraphUnit {
  type: UnitType;
  raw: string; // Original text including Markdown markers
  text: string; // Text to translate (markers stripped for headings)
  lineStart: number; // Starting line index (0-based)
  lineEnd: number; // Ending line index (0-based, inclusive)
}

export function parseParagraphs(content: string): ParagraphUnit[] {
  if (!content.trim()) return [];

  const lines = content.split("\n");
  const blocks = splitIntoBlocks(lines);
  const units: ParagraphUnit[] = [];

  for (const block of blocks) {
    if (shouldSkip(block.lines)) continue;

    const raw = block.lines.join("\n");
    const firstLine = block.lines[0];

    if (isHeading(firstLine)) {
      const match = firstLine.match(/^(#{1,6})\s+(.+)$/);
      if (match) {
        units.push({
          type: "heading",
          raw,
          text: match[2],
          lineStart: block.start,
          lineEnd: block.end,
        });
      }
    } else if (isList(block.lines)) {
      units.push({
        type: "list",
        raw,
        text: raw,
        lineStart: block.start,
        lineEnd: block.end,
      });
    } else {
      units.push({
        type: "paragraph",
        raw,
        text: raw,
        lineStart: block.start,
        lineEnd: block.end,
      });
    }
  }

  return units;
}

interface Block {
  lines: string[];
  start: number;
  end: number;
}

function splitIntoBlocks(lines: string[]): Block[] {
  const blocks: Block[] = [];
  let current: string[] = [];
  let start = 0;
  let inFrontmatter = false;
  let inCodeBlock = false;
  let inMathBlock = false;
  let frontmatterDone = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Frontmatter detection (must be at very start)
    if (i === 0 && trimmed === "---") {
      inFrontmatter = true;
      continue;
    }
    if (inFrontmatter) {
      if (trimmed === "---") {
        inFrontmatter = false;
        frontmatterDone = true;
      }
      continue;
    }

    // Code block detection
    if (trimmed.startsWith("```")) {
      if (!inCodeBlock) {
        // Flush current block before entering code block
        if (current.length > 0) {
          blocks.push({ lines: current, start, end: i - 1 });
          current = [];
        }
        inCodeBlock = true;
        continue;
      } else {
        inCodeBlock = false;
        continue;
      }
    }
    if (inCodeBlock) continue;

    // Math block detection
    if (trimmed === "$$") {
      if (!inMathBlock) {
        if (current.length > 0) {
          blocks.push({ lines: current, start, end: i - 1 });
          current = [];
        }
        inMathBlock = true;
        continue;
      } else {
        inMathBlock = false;
        continue;
      }
    }
    if (inMathBlock) continue;

    // Blank line = block separator
    if (trimmed === "") {
      if (current.length > 0) {
        blocks.push({ lines: current, start, end: i - 1 });
        current = [];
      }
      continue;
    }

    if (current.length === 0) {
      start = i;
    }
    current.push(line);
  }

  if (current.length > 0) {
    blocks.push({ lines: current, start, end: start + current.length - 1 });
  }

  return blocks;
}

function shouldSkip(lines: string[]): boolean {
  const first = lines[0].trim();

  // Image
  if (/^!\[.*\]\(.*\)$/.test(first) && lines.length === 1) return true;

  // Embed
  if (/^!\[\[.*\]\]$/.test(first) && lines.length === 1) return true;

  // HTML block
  if (/^<\/?[a-zA-Z]/.test(first)) return true;

  // Callout
  if (/^>\s*\[!/.test(first)) return true;

  // Table (has | at start and a separator line with ---)
  if (first.startsWith("|") && lines.length >= 2) {
    const secondLine = lines[1].trim();
    if (/^\|[\s\-:|]+\|$/.test(secondLine)) return true;
  }

  return false;
}

function isHeading(line: string): boolean {
  return /^#{1,6}\s+/.test(line);
}

function isList(lines: string[]): boolean {
  return /^(\s*[-*+]|\s*\d+\.)\s+/.test(lines[0]);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run test -- tests/parser.test.ts`
Expected: All 13 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/parser.ts tests/parser.test.ts
git commit -m "feat: 添加 Markdown 段落解析器"
```

---

### Task 4: Inserter

**Files:**
- Create: `src/inserter.ts`, `tests/inserter.test.ts`

- [ ] **Step 1: Write failing tests for inserter**

Create `tests/inserter.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { buildInsertedContent } from "../src/inserter";
import { parseParagraphs } from "../src/parser";

describe("buildInsertedContent", () => {
  it("inserts translated paragraphs after originals", () => {
    const original = "First paragraph.\n\nSecond paragraph.";
    const units = parseParagraphs(original);
    const translations = ["第一段。", "第二段。"];

    const result = buildInsertedContent(original, units, translations);
    expect(result).toBe(
      "First paragraph.\n\n第一段。\n\nSecond paragraph.\n\n第二段。"
    );
  });

  it("inserts translated heading below original heading", () => {
    const original = "# Introduction\n\nSome text.";
    const units = parseParagraphs(original);
    const translations = ["介绍", "一些文本。"];

    const result = buildInsertedContent(original, units, translations);
    expect(result).toBe(
      "# Introduction\n# 介绍\n\nSome text.\n\n一些文本。"
    );
  });

  it("inserts translated list after original list", () => {
    const original = "Before.\n\n- Item one\n- Item two\n\nAfter.";
    const units = parseParagraphs(original);
    // For lists, the translation is the full translated list
    const translations = ["之前。", "- 第一项\n- 第二项", "之后。"];

    const result = buildInsertedContent(original, units, translations);
    expect(result).toBe(
      "Before.\n\n之前。\n\n- Item one\n- Item two\n\n- 第一项\n- 第二项\n\nAfter.\n\n之后。"
    );
  });

  it("preserves frontmatter and code blocks", () => {
    const original =
      "---\ntitle: Test\n---\n\nHello.\n\n```js\ncode()\n```\n\nWorld.";
    const units = parseParagraphs(original);
    const translations = ["你好。", "世界。"];

    const result = buildInsertedContent(original, units, translations);
    expect(result).toContain("---\ntitle: Test\n---");
    expect(result).toContain("```js\ncode()\n```");
    expect(result).toContain("Hello.\n\n你好。");
    expect(result).toContain("World.\n\n世界。");
  });

  it("handles content with no translatable units", () => {
    const original = "---\ntitle: Test\n---\n\n```js\ncode()\n```";
    const units = parseParagraphs(original);
    const translations: string[] = [];

    const result = buildInsertedContent(original, units, translations);
    expect(result).toBe(original);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test -- tests/inserter.test.ts`
Expected: FAIL — `buildInsertedContent` not found.

- [ ] **Step 3: Implement inserter**

Create `src/inserter.ts`:

```typescript
import type { ParagraphUnit } from "./parser";

/**
 * Builds new content with translations inserted after corresponding original paragraphs.
 * Works by processing units from bottom to top to preserve line offsets.
 */
export function buildInsertedContent(
  originalContent: string,
  units: ParagraphUnit[],
  translations: string[]
): string {
  if (units.length === 0 || translations.length === 0) return originalContent;

  const lines = originalContent.split("\n");

  // Process from bottom to top so line numbers remain valid
  for (let i = units.length - 1; i >= 0; i--) {
    const unit = units[i];
    const translation = translations[i];
    if (!translation) continue;

    if (unit.type === "heading") {
      // Insert translated heading directly below original heading (same line group)
      const headingMatch = unit.raw.match(/^(#{1,6})\s+/);
      const prefix = headingMatch ? headingMatch[1] : "#";
      const translatedLine = `${prefix} ${translation}`;
      lines.splice(unit.lineEnd + 1, 0, translatedLine);
    } else {
      // Insert translated block after the original block with a blank line separator
      const translatedLines = translation.split("\n");
      lines.splice(unit.lineEnd + 1, 0, "", ...translatedLines);
    }
  }

  return lines.join("\n");
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run test -- tests/inserter.test.ts`
Expected: All 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/inserter.ts tests/inserter.test.ts
git commit -m "feat: 添加译文插入器"
```

---

### Task 5: Settings

**Files:**
- Create: `src/settings.ts`

- [ ] **Step 1: Create settings module**

Create `src/settings.ts`:

```typescript
import { App, PluginSettingTab, Setting } from "obsidian";
import type ImmersiveTranslatePlugin from "./main";

export interface ImmersiveTranslateSettings {
  sourceLanguage: string;
  targetLanguage: string;
  engine: string;
}

export const DEFAULT_SETTINGS: ImmersiveTranslateSettings = {
  sourceLanguage: "auto",
  targetLanguage: "zh-CN",
  engine: "google",
};

export const LANGUAGES: Record<string, string> = {
  auto: "Auto-detect",
  en: "English",
  "zh-CN": "Chinese (Simplified)",
  "zh-TW": "Chinese (Traditional)",
  ja: "Japanese",
  ko: "Korean",
  fr: "French",
  de: "German",
  es: "Spanish",
  pt: "Portuguese",
  ru: "Russian",
  ar: "Arabic",
};

export class ImmersiveTranslateSettingTab extends PluginSettingTab {
  plugin: ImmersiveTranslatePlugin;

  constructor(app: App, plugin: ImmersiveTranslatePlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName("Source language")
      .setDesc("Language of the original text")
      .addDropdown((dropdown) => {
        for (const [code, name] of Object.entries(LANGUAGES)) {
          dropdown.addOption(code, name);
        }
        dropdown.setValue(this.plugin.settings.sourceLanguage);
        dropdown.onChange(async (value) => {
          this.plugin.settings.sourceLanguage = value;
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName("Target language")
      .setDesc("Language to translate into")
      .addDropdown((dropdown) => {
        for (const [code, name] of Object.entries(LANGUAGES)) {
          if (code === "auto") continue; // Target can't be auto
          dropdown.addOption(code, name);
        }
        dropdown.setValue(this.plugin.settings.targetLanguage);
        dropdown.onChange(async (value) => {
          this.plugin.settings.targetLanguage = value;
          await this.plugin.saveSettings();
        });
      });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/settings.ts
git commit -m "feat: 添加插件设置面板"
```

---

### Task 6: Preview Panel (TranslateView)

**Files:**
- Create: `src/view.ts`

- [ ] **Step 1: Implement TranslateView**

Create `src/view.ts`:

```typescript
import { ItemView, WorkspaceLeaf, Notice } from "obsidian";
import type ImmersiveTranslatePlugin from "./main";
import type { ParagraphUnit } from "./parser";
import { parseParagraphs } from "./parser";
import { buildInsertedContent } from "./inserter";

export const VIEW_TYPE_TRANSLATE = "immersive-translate-view";

interface TranslationState {
  units: ParagraphUnit[];
  translations: string[];
  sourceFilePath: string;
}

export class TranslateView extends ItemView {
  plugin: ImmersiveTranslatePlugin;
  private state: TranslationState | null = null;
  private translateBtn: HTMLButtonElement | null = null;
  private insertBtn: HTMLButtonElement | null = null;
  private contentEl_body: HTMLElement | null = null;
  private isTranslating = false;
  private inserted = false;

  constructor(leaf: WorkspaceLeaf, plugin: ImmersiveTranslatePlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return VIEW_TYPE_TRANSLATE;
  }

  getDisplayText(): string {
    return "Immersive Translate";
  }

  getIcon(): string {
    return "languages";
  }

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.addClass("immersive-translate-container");

    // Toolbar
    const toolbar = container.createDiv("immersive-translate-toolbar");

    this.translateBtn = toolbar.createEl("button", { text: "Translate" });
    this.translateBtn.addEventListener("click", () => this.doTranslate());

    this.insertBtn = toolbar.createEl("button", { text: "Insert into Note" });
    this.insertBtn.disabled = true;
    this.insertBtn.addEventListener("click", () => this.doInsert());

    // Content body
    this.contentEl_body = container.createDiv("immersive-translate-body");
  }

  async onClose(): Promise<void> {
    this.state = null;
  }

  private async doTranslate(): Promise<void> {
    const activeFile = this.app.workspace.getActiveFile();
    if (!activeFile || activeFile.extension !== "md") {
      new Notice("No active Markdown note found.");
      return;
    }

    if (this.isTranslating) return;
    this.isTranslating = true;
    this.inserted = false;
    this.translateBtn!.disabled = true;
    this.insertBtn!.disabled = true;
    this.contentEl_body!.empty();

    try {
      const content = await this.app.vault.read(activeFile);
      const units = parseParagraphs(content);

      if (units.length === 0) {
        new Notice("No translatable content found.");
        this.isTranslating = false;
        this.translateBtn!.disabled = false;
        return;
      }

      const { sourceLanguage, targetLanguage } = this.plugin.settings;
      const engine = this.plugin.getEngine();
      const translations: string[] = [];

      this.state = {
        units,
        translations,
        sourceFilePath: activeFile.path,
      };

      for (let i = 0; i < units.length; i++) {
        const unit = units[i];

        // Render original
        const unitDiv = this.contentEl_body!.createDiv(
          "immersive-translate-unit"
        );
        unitDiv.createDiv({
          cls: "immersive-translate-original",
          text: unit.raw,
        });

        try {
          const translated = await engine.translate(
            unit.text,
            sourceLanguage,
            targetLanguage
          );
          translations.push(translated);

          // Render translation — for headings, show with # prefix
          let displayText = translated;
          if (unit.type === "heading") {
            const match = unit.raw.match(/^(#{1,6})\s+/);
            displayText = match ? `${match[1]} ${translated}` : translated;
          }
          unitDiv.createDiv({
            cls: "immersive-translate-translated",
            text: displayText,
          });
        } catch (err: any) {
          new Notice(`Translation failed: ${err.message}`);
          break;
        }
      }

      // Enable insert button if we have translations
      if (translations.length > 0) {
        this.insertBtn!.disabled = false;
      }
    } finally {
      this.isTranslating = false;
      this.translateBtn!.disabled = false;
    }
  }

  private async doInsert(): Promise<void> {
    if (!this.state || this.inserted) return;

    const { units, translations, sourceFilePath } = this.state;
    const file = this.app.vault.getAbstractFileByPath(sourceFilePath);
    if (!file) {
      new Notice("Source file not found.");
      return;
    }

    try {
      const content = await this.app.vault.read(file as any);
      const newContent = buildInsertedContent(content, units, translations);
      await this.app.vault.modify(file as any, newContent);
      this.inserted = true;
      this.insertBtn!.disabled = true;
      new Notice("Translations inserted into note.");
    } catch (err: any) {
      new Notice(`Insert failed: ${err.message}`);
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/view.ts
git commit -m "feat: 添加翻译预览面板"
```

---

### Task 7: Plugin Entry Point (main.ts)

**Files:**
- Create: `src/main.ts`

- [ ] **Step 1: Implement main plugin class**

Create `src/main.ts`:

```typescript
import { Plugin } from "obsidian";
import type { TranslationEngine } from "./engine/types";
import { GoogleTranslateEngine } from "./engine/google";
import {
  ImmersiveTranslateSettingTab,
  ImmersiveTranslateSettings,
  DEFAULT_SETTINGS,
} from "./settings";
import { TranslateView, VIEW_TYPE_TRANSLATE } from "./view";

export default class ImmersiveTranslatePlugin extends Plugin {
  settings: ImmersiveTranslateSettings = DEFAULT_SETTINGS;
  private engines: Map<string, TranslationEngine> = new Map();

  async onload(): Promise<void> {
    await this.loadSettings();

    // Register engines
    this.engines.set("google", new GoogleTranslateEngine());

    // Register view
    this.registerView(VIEW_TYPE_TRANSLATE, (leaf) => {
      return new TranslateView(leaf, this);
    });

    // Register command: translate current note
    this.addCommand({
      id: "translate-current-note",
      name: "Translate current note",
      callback: () => this.activateView(),
    });

    // Register command: open translate panel
    this.addCommand({
      id: "open-translate-panel",
      name: "Open translate panel",
      callback: () => this.activateView(),
    });

    // Settings tab
    this.addSettingTab(new ImmersiveTranslateSettingTab(this.app, this));
  }

  onunload(): void {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_TRANSLATE);
  }

  getEngine(): TranslationEngine {
    const engine = this.engines.get(this.settings.engine);
    if (!engine) {
      throw new Error(`Unknown translation engine: ${this.settings.engine}`);
    }
    return engine;
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  private async activateView(): Promise<void> {
    const existing =
      this.app.workspace.getLeavesOfType(VIEW_TYPE_TRANSLATE);

    if (existing.length === 0) {
      const leaf = this.app.workspace.getRightLeaf(false);
      if (leaf) {
        await leaf.setViewState({
          type: VIEW_TYPE_TRANSLATE,
          active: true,
        });
        this.app.workspace.revealLeaf(leaf);
      }
    } else {
      this.app.workspace.revealLeaf(existing[0]);
    }
  }
}
```

- [ ] **Step 2: Build the plugin**

Run: `bun run build`
Expected: `main.js` created successfully with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/main.ts
git commit -m "feat: 添加插件入口，注册命令和视图"
```

---

### Task 8: End-to-End Manual Testing

**Files:** None (manual testing in Obsidian)

- [ ] **Step 1: Build production bundle**

Run: `bun run build`
Expected: `main.js` generated with no errors.

- [ ] **Step 2: Copy plugin to Obsidian vault for testing**

The user needs to copy the following files to their Obsidian vault's `.obsidian/plugins/obsidian-immersive-translate/` directory:
- `main.js`
- `manifest.json`
- `styles.css`

Or create a symlink for easier development iteration.

- [ ] **Step 3: Test in Obsidian**

Manual test checklist:
1. Enable the plugin in Obsidian Settings → Community plugins
2. Open a note with English content
3. Cmd+P → "Translate current note" → verify panel opens on the right
4. Click "Translate" button → verify paragraphs appear progressively with translations
5. Verify: frontmatter, code blocks, images, math blocks are skipped
6. Verify: headings show translated heading below original
7. Verify: lists show translated list after original list
8. Click "Insert into Note" → verify translations written into source file
9. Verify: Insert button becomes disabled after insertion
10. Click "Translate" again → verify button re-enables and new translation works

- [ ] **Step 4: Fix any issues found during testing**

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "chore: 完成 v0.1.0 初始版本"
```
