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
