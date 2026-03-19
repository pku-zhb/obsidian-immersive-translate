import { requestUrl } from "obsidian";
import type { TranslationEngine } from "./types";

const TRANSLATE_URL =
  "https://translate.googleapis.com/translate_a/single?client=gtx&dt=t&dt=rm&dj=1";

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 2000;
const REQUEST_GAP_MS = 300;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let lastRequestTime = 0;

export class GoogleTranslateEngine implements TranslationEngine {
  name = "Google Translate";

  async translate(text: string, from: string, to: string): Promise<string> {
    // Throttle: ensure minimum gap between requests
    const now = Date.now();
    const elapsed = now - lastRequestTime;
    if (elapsed < REQUEST_GAP_MS) {
      await sleep(REQUEST_GAP_MS - elapsed);
    }
    lastRequestTime = Date.now();

    const body = new URLSearchParams({ sl: from, tl: to, q: text }).toString();

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
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
      } catch (err: any) {
        lastError = err;
        const is429 = err.message?.includes("429") || err.status === 429;
        if (is429 && attempt < MAX_RETRIES) {
          await sleep(BASE_DELAY_MS * Math.pow(2, attempt));
          continue;
        }
        throw err;
      }
    }

    throw lastError;
  }
}
