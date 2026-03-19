import { describe, it, expect, vi, beforeEach } from "vitest";
import { requestUrl } from "obsidian";
import { GoogleTranslateEngine } from "../../src/engine/google";

const mockRequestUrl = vi.mocked(requestUrl);

describe("GoogleTranslateEngine", () => {
  beforeEach(() => {
    mockRequestUrl.mockReset();
  });

  it("has the correct name", () => {
    const engine = new GoogleTranslateEngine();
    expect(engine.name).toBe("Google Translate");
  });

  it("translates text via Google Translate endpoint", async () => {
    mockRequestUrl.mockResolvedValueOnce({
      json: {
        sentences: [{ trans: "你好世界" }],
      },
    } as any);

    const engine = new GoogleTranslateEngine();
    const result = await engine.translate("Hello world", "en", "zh-CN");

    expect(result).toBe("你好世界");
    expect(mockRequestUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("q=Hello+world"),
      })
    );
  });

  it("joins multiple sentence fragments", async () => {
    mockRequestUrl.mockResolvedValueOnce({
      json: {
        sentences: [
          { trans: "你好" },
          { trans: "世界" },
          { translit: "nǐ hǎo shì jiè" },
        ],
      },
    } as any);

    const engine = new GoogleTranslateEngine();
    const result = await engine.translate("Hello world", "en", "zh-CN");

    expect(result).toBe("你好世界");
  });

  it("passes 'auto' as source language for auto-detect", async () => {
    mockRequestUrl.mockResolvedValueOnce({
      json: { sentences: [{ trans: "你好" }] },
    } as any);

    const engine = new GoogleTranslateEngine();
    await engine.translate("Hello", "auto", "zh-CN");

    expect(mockRequestUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.stringContaining("sl=auto"),
      })
    );
  });

  it("throws on network failure", async () => {
    mockRequestUrl.mockRejectedValueOnce(new Error("Network error"));

    const engine = new GoogleTranslateEngine();
    await expect(engine.translate("Hello", "en", "zh-CN")).rejects.toThrow(
      "Network error"
    );
  });

  it("throws on unexpected response format", async () => {
    mockRequestUrl.mockResolvedValueOnce({
      json: { unexpected: true },
    } as any);

    const engine = new GoogleTranslateEngine();
    await expect(engine.translate("Hello", "en", "zh-CN")).rejects.toThrow(
      "Unexpected response format"
    );
  });
});
