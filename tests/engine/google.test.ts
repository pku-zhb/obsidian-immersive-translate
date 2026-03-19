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
