import translate from "google-translate-api-x";
import type { TranslationEngine } from "./types";

export class GoogleTranslateEngine implements TranslationEngine {
  name = "Google Translate";

  async translate(text: string, from: string, to: string): Promise<string> {
    const result = await translate(text, { from, to });
    return result.text;
  }
}
