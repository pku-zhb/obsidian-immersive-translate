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
