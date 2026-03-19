import { App, PluginSettingTab, Setting } from "obsidian";
import type ImmersiveTranslatePlugin from "./main";

export type InsertMode = "side-by-side" | "blockquote";

export interface ImmersiveTranslateSettings {
  sourceLanguage: string;
  targetLanguage: string;
  engine: string;
  insertMode: InsertMode;
}

export const DEFAULT_SETTINGS: ImmersiveTranslateSettings = {
  sourceLanguage: "auto",
  targetLanguage: "zh-CN",
  engine: "google",
  insertMode: "side-by-side",
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
      .setName("Insert mode")
      .setDesc("How translations are inserted into notes")
      .addDropdown((dropdown) => {
        dropdown.addOption("side-by-side", "Side by side (original + translation)");
        dropdown.addOption("blockquote", "Blockquote (original as quote, translation below)");
        dropdown.setValue(this.plugin.settings.insertMode);
        dropdown.onChange(async (value) => {
          this.plugin.settings.insertMode = value as InsertMode;
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName("Target language")
      .setDesc("Language to translate into")
      .addDropdown((dropdown) => {
        for (const [code, name] of Object.entries(LANGUAGES)) {
          if (code === "auto") continue;
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
