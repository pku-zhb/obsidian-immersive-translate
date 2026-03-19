import { requestUrl } from "obsidian";
import type { TranslationEngine } from "./types";

const TRANSLATE_URL =
  "https://translate.google.com/translate_a/single?client=at&dt=t&dt=rm&dj=1";

export class GoogleTranslateEngine implements TranslationEngine {
  name = "Google Translate";

  async translate(text: string, from: string, to: string): Promise<string> {
    const body = new URLSearchParams({ sl: from, tl: to, q: text }).toString();

    const response = await requestUrl({
      url: TRANSLATE_URL,
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });

    const data = response.json;

    if (!data.sentences || !Array.isArray(data.sentences)) {
      throw new Error("Unexpected response format from Google Translate");
    }

    return data.sentences
      .filter((s: any) => s.trans)
      .map((s: any) => s.trans)
      .join("");
  }
}
