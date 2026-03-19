import { ItemView, MarkdownRenderer, Notice, WorkspaceLeaf } from "obsidian";
import type ImmersiveTranslatePlugin from "./main";
import type { ParagraphUnit } from "./parser";
import { parseParagraphs } from "./parser";
import { buildInsertedContent } from "./inserter";

export const VIEW_TYPE_TRANSLATE = "immersive-translate-view";

interface TranslationState {
  units: ParagraphUnit[];
  translations: (string | null)[];
  sourceFilePath: string;
}

export class TranslateView extends ItemView {
  plugin: ImmersiveTranslatePlugin;
  private state: TranslationState | null = null;
  private translateBtn: HTMLButtonElement | null = null;
  private stopBtn: HTMLButtonElement | null = null;
  private insertBtn: HTMLButtonElement | null = null;
  private contentEl_body: HTMLElement | null = null;
  private progressArea: HTMLElement | null = null;
  private progressBar: HTMLProgressElement | null = null;
  private progressLabel: HTMLElement | null = null;
  private fileInfoEl: HTMLElement | null = null;
  private isTranslating = false;
  private stopRequested = false;
  private inserted = false;
  private activeFileHandler: (() => void) | null = null;

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

    this.stopBtn = toolbar.createEl("button", { text: "Stop" });
    this.stopBtn.disabled = true;
    this.stopBtn.addEventListener("click", () => this.doStop());

    this.insertBtn = toolbar.createEl("button", { text: "Insert into Note" });
    this.insertBtn.disabled = true;
    this.insertBtn.addEventListener("click", () => this.doInsert());

    // File info (tracks active file)
    this.fileInfoEl = container.createDiv("immersive-translate-file-info");
    this.updateFileInfo();

    // Listen for active file changes
    this.activeFileHandler = () => {
      if (!this.isTranslating && !this.state) {
        this.updateFileInfo();
      }
    };
    this.app.workspace.on("active-leaf-change", this.activeFileHandler);

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
    if (this.activeFileHandler) {
      this.app.workspace.off("active-leaf-change", this.activeFileHandler);
      this.activeFileHandler = null;
    }
  }

  private updateFileInfo(): void {
    if (!this.fileInfoEl) return;
    const activeFile = this.app.workspace.getActiveFile();
    if (activeFile && activeFile.extension === "md") {
      this.fileInfoEl.textContent = `📄 ${activeFile.path}`;
      this.fileInfoEl.style.display = "block";
    } else {
      this.fileInfoEl.textContent = "No active Markdown note";
      this.fileInfoEl.style.display = "block";
    }
  }

  private resetToIdle(): void {
    this.state = null;
    this.inserted = false;
    this.insertBtn!.disabled = true;
    this.progressArea!.style.display = "none";
    this.contentEl_body!.empty();
    this.updateFileInfo();
  }

  private updateProgress(completed: number, total: number, hasError: boolean): void {
    if (!this.progressArea || !this.progressBar || !this.progressLabel) return;

    this.progressArea.style.display = "flex";
    this.progressBar.max = total;
    this.progressBar.value = completed;

    if (this.stopRequested && completed < total) {
      this.progressLabel.textContent = `已停止 ${completed}/${total}`;
    } else if (completed >= total && hasError) {
      this.progressLabel.textContent = `翻译中断 ${completed}/${total}（出错）`;
    } else if (completed >= total) {
      this.progressLabel.textContent = `翻译完成 ${completed}/${total}`;
    } else if (hasError) {
      this.progressLabel.textContent = `翻译中 ${completed}/${total}（部分出错）`;
    } else {
      this.progressLabel.textContent = `翻译中 ${completed}/${total}`;
    }
  }

  private doStop(): void {
    this.stopRequested = true;
    this.stopBtn!.disabled = true;
  }

  private async doTranslate(): Promise<void> {
    const activeFile = this.app.workspace.getActiveFile();
    if (!activeFile || activeFile.extension !== "md") {
      new Notice("No active Markdown note found.");
      return;
    }

    if (this.isTranslating) return;
    this.isTranslating = true;
    this.stopRequested = false;
    this.inserted = false;
    this.translateBtn!.disabled = true;
    this.stopBtn!.disabled = false;
    this.insertBtn!.disabled = true;
    this.contentEl_body!.empty();
    this.progressArea!.style.display = "none";

    // Show which file is being translated
    this.fileInfoEl!.textContent = `📄 ${activeFile.path}`;

    try {
      const content = await this.app.vault.read(activeFile);
      const units = parseParagraphs(content);

      if (units.length === 0) {
        new Notice("No translatable content found.");
        this.isTranslating = false;
        this.translateBtn!.disabled = false;
        this.stopBtn!.disabled = true;
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

        const originalDiv = unitDiv.createDiv("immersive-translate-original");
        await MarkdownRenderer.render(
          this.app,
          unit.raw,
          originalDiv,
          sourcePath,
          this.plugin
        );

        const translatedDiv = unitDiv.createDiv("immersive-translate-translated");
        translationPlaceholders.push(translatedDiv);
      }

      // Serial translation with stop support
      let completed = 0;
      let errorCount = 0;
      this.updateProgress(0, units.length, false);

      for (let i = 0; i < units.length; i++) {
        if (this.stopRequested) break;

        const unit = units[i];

        try {
          const translated = await engine.translate(
            unit.text,
            sourceLanguage,
            targetLanguage
          );
          translations[i] = translated;

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
        }

        completed++;
        this.updateProgress(completed, units.length, errorCount > 0);
      }

      if (this.stopRequested) {
        this.updateProgress(completed, units.length, errorCount > 0);
      }

      // Enable insert button if any translations succeeded
      const successCount = translations.filter((t) => t !== null).length;
      if (successCount > 0) {
        this.insertBtn!.disabled = false;
      }
    } finally {
      this.isTranslating = false;
      this.translateBtn!.disabled = false;
      this.stopBtn!.disabled = true;
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

      const successUnits = units.filter((_, i) => translations[i] !== null);
      const successTranslations = translations.filter((t) => t !== null) as string[];

      const newContent = buildInsertedContent(
        content,
        successUnits,
        successTranslations,
        this.plugin.settings.insertMode
      );
      await this.app.vault.modify(file as any, newContent);
      new Notice("Translations inserted into note.");
      this.resetToIdle();
    } catch (err: any) {
      new Notice(`Insert failed: ${err.message}`);
    }
  }
}
