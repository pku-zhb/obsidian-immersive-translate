# V2 UX Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add progress indicator, Markdown rendering, and concurrent translation to the translate panel.

**Architecture:** All changes are in `src/view.ts` (logic) and `styles.css` (presentation). The three features are tightly coupled in `doTranslate()` — progress updates, DOM pre-creation, and concurrent execution all interact in the same method. Best implemented as a single coherent rewrite of view.ts rather than incremental layering.

**Tech Stack:** Obsidian API (`MarkdownRenderer`, `ItemView`, `Notice`), TypeScript, CSS.

**Spec:** `docs/superpowers/specs/2026-03-19-v2-ux-improvements-design.md`

---

### Task 1: Update CSS

**Files:**
- Modify: `styles.css`

No dependencies. Can be done first.

- [ ] **Step 1: Add progress bar and translated block styles**

Replace `styles.css` with:

```css
.immersive-translate-container {
  padding: 10px;
}

.immersive-translate-toolbar {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--background-modifier-border);
}

.immersive-translate-toolbar button {
  flex: 1;
}

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

.immersive-translate-unit {
  margin-bottom: 16px;
}

.immersive-translate-original {
  margin-bottom: 4px;
}

.immersive-translate-translated {
  margin-bottom: 4px;
  opacity: 0.85;
  border-left: 2px solid var(--interactive-accent);
  padding-left: 8px;
}

.immersive-translate-error {
  color: var(--text-error);
  font-size: 12px;
  padding: 4px 0;
}
```

- [ ] **Step 2: Commit**

```bash
git add styles.css
git commit -m "style: 添加进度条和译文区块样式"
```

---

### Task 2: Rewrite view.ts

**Files:**
- Modify: `src/view.ts`

This task rewrites `doTranslate()` and `doInsert()` to add all three features: progress bar, Markdown rendering, and concurrent translation.

- [ ] **Step 1: Rewrite view.ts**

Replace `src/view.ts` with:

```typescript
import { ItemView, MarkdownRenderer, Notice, WorkspaceLeaf } from "obsidian";
import type ImmersiveTranslatePlugin from "./main";
import type { ParagraphUnit } from "./parser";
import { parseParagraphs } from "./parser";
import { buildInsertedContent } from "./inserter";

export const VIEW_TYPE_TRANSLATE = "immersive-translate-view";

const CONCURRENCY = 3;

interface TranslationState {
  units: ParagraphUnit[];
  translations: (string | null)[];
  sourceFilePath: string;
}

export class TranslateView extends ItemView {
  plugin: ImmersiveTranslatePlugin;
  private state: TranslationState | null = null;
  private translateBtn: HTMLButtonElement | null = null;
  private insertBtn: HTMLButtonElement | null = null;
  private contentEl_body: HTMLElement | null = null;
  private progressArea: HTMLElement | null = null;
  private progressBar: HTMLProgressElement | null = null;
  private progressLabel: HTMLElement | null = null;
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

    // Progress area (hidden by default)
    this.progressArea = container.createDiv("immersive-translate-progress");
    this.progressArea.style.display = "none";
    this.progressBar = this.progressArea.createEl("progress");
    this.progressLabel = this.progressArea.createEl("span", {
      cls: "progress-label",
    });

    // Content body
    this.contentEl_body = container.createDiv("immersive-translate-body");
  }

  async onClose(): Promise<void> {
    this.state = null;
  }

  private updateProgress(completed: number, total: number, hasError: boolean): void {
    if (!this.progressArea || !this.progressBar || !this.progressLabel) return;

    this.progressArea.style.display = "flex";
    this.progressBar.max = total;
    this.progressBar.value = completed;

    if (completed >= total && hasError) {
      this.progressLabel.textContent = `翻译中断 ${completed}/${total}（出错）`;
    } else if (completed >= total) {
      this.progressLabel.textContent = `翻译完成 ${completed}/${total}`;
    } else if (hasError) {
      this.progressLabel.textContent = `翻译中 ${completed}/${total}（部分出错）`;
    } else {
      this.progressLabel.textContent = `翻译中 ${completed}/${total}`;
    }
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
    this.progressArea!.style.display = "none";

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
      const translations: (string | null)[] = new Array(units.length).fill(null);
      const sourcePath = activeFile.path;

      this.state = { units, translations, sourceFilePath: sourcePath };

      // Pre-create all unit divs with original text rendered
      const translationPlaceholders: HTMLElement[] = [];

      for (const unit of units) {
        const unitDiv = this.contentEl_body!.createDiv("immersive-translate-unit");

        // Render original via MarkdownRenderer
        const originalDiv = unitDiv.createDiv("immersive-translate-original");
        await MarkdownRenderer.render(
          this.app,
          unit.raw,
          originalDiv,
          sourcePath,
          this.plugin
        );

        // Create empty placeholder for translation
        const translatedDiv = unitDiv.createDiv("immersive-translate-translated");
        translationPlaceholders.push(translatedDiv);
      }

      // Show initial progress
      let completed = 0;
      let errorCount = 0;
      this.updateProgress(0, units.length, false);

      // Concurrent translation with bounded pool
      let nextIndex = 0;

      const translateUnit = async (i: number): Promise<void> => {
        try {
          const unit = units[i];
          const translated = await engine.translate(
            unit.text,
            sourceLanguage,
            targetLanguage
          );
          translations[i] = translated;

          // Render translation with MarkdownRenderer
          let displayText = translated;
          if (unit.type === "heading") {
            const match = unit.raw.match(/^(#{1,6})\s+/);
            displayText = match ? `${match[1]} ${translated}` : translated;
          }
          await MarkdownRenderer.render(
            this.app,
            displayText,
            translationPlaceholders[i],
            sourcePath,
            this.plugin
          );
        } catch (err: any) {
          translations[i] = null;
          errorCount++;
          translationPlaceholders[i].createDiv({
            cls: "immersive-translate-error",
            text: `翻译失败: ${err.message}`,
          });
        } finally {
          completed++;
          this.updateProgress(completed, units.length, errorCount > 0);
        }
      };

      // Pool executor
      const pool: Promise<void>[] = [];

      const fillPool = (): void => {
        while (pool.length < CONCURRENCY && nextIndex < units.length) {
          const i = nextIndex++;
          const p = translateUnit(i).then(() => {
            const idx = pool.indexOf(p);
            if (idx !== -1) pool.splice(idx, 1);
          });
          pool.push(p);
        }
      };

      fillPool();
      while (pool.length > 0) {
        await Promise.race(pool);
        fillPool();
      }

      // Enable insert button if any translations succeeded
      const successCount = translations.filter((t) => t !== null).length;
      if (successCount > 0) {
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

      // Filter out failed translations (null slots)
      const successUnits = units.filter((_, i) => translations[i] !== null);
      const successTranslations = translations.filter((t) => t !== null) as string[];

      const newContent = buildInsertedContent(content, successUnits, successTranslations);
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

- [ ] **Step 2: Verify build succeeds**

Run: `bun run build`
Expected: `main.js` built with no errors.

- [ ] **Step 3: Verify existing tests still pass**

Run: `bun run test`
Expected: All 24 tests pass (parser 13, inserter 5, engine 6). No regressions.

- [ ] **Step 4: Commit**

```bash
git add src/view.ts
git commit -m "feat: 添加进度条、Markdown 渲染和并发翻译"
```

---

### Task 3: Deploy and Manual Test

**Files:**
- Copy: `main.js`, `styles.css` → Obsidian vault plugins directory

- [ ] **Step 1: Copy built files to Obsidian vault**

```bash
cp main.js styles.css "/Users/zhuhuibin/Nutstore Files/Nutstore/.obsidian/plugins/obsidian-immersive-translate/"
```

- [ ] **Step 2: Manual test checklist**

Restart Obsidian (or disable/enable plugin), then verify:

1. **Progress bar**: Open a note with 5+ paragraphs → Translate → progress bar shows and updates → shows "翻译完成 X/X" when done
2. **Markdown rendering**: Translate a note with headings, lists, links → panel renders them with proper formatting (not raw text)
3. **Concurrency**: Translate a long note (10+ paragraphs) → noticeable speed improvement vs v1 serial
4. **Insert with partial failure**: If any paragraph failed, Insert should skip failed ones and insert successful ones correctly
5. **Empty note**: Note with only code blocks/frontmatter → "No translatable content found" notice, progress bar stays hidden

- [ ] **Step 3: Push to GitHub**

```bash
git push origin main
```
