import { describe, it, expect } from "vitest";
import { buildInsertedContent } from "../src/inserter";
import { parseParagraphs } from "../src/parser";

describe("buildInsertedContent — side-by-side mode", () => {
  it("inserts translated paragraphs after originals", () => {
    const original = "First paragraph.\n\nSecond paragraph.";
    const units = parseParagraphs(original);
    const translations = ["第一段。", "第二段。"];

    const result = buildInsertedContent(original, units, translations, "side-by-side");
    expect(result).toBe(
      "First paragraph.\n\n第一段。\n\nSecond paragraph.\n\n第二段。"
    );
  });

  it("inserts translated heading below original heading", () => {
    const original = "# Introduction\n\nSome text.";
    const units = parseParagraphs(original);
    const translations = ["介绍", "一些文本。"];

    const result = buildInsertedContent(original, units, translations, "side-by-side");
    expect(result).toBe(
      "# Introduction\n# 介绍\n\nSome text.\n\n一些文本。"
    );
  });

  it("inserts translated list after original list", () => {
    const original = "Before.\n\n- Item one\n- Item two\n\nAfter.";
    const units = parseParagraphs(original);
    const translations = ["之前。", "- 第一项\n- 第二项", "之后。"];

    const result = buildInsertedContent(original, units, translations, "side-by-side");
    expect(result).toBe(
      "Before.\n\n之前。\n\n- Item one\n- Item two\n\n- 第一项\n- 第二项\n\nAfter.\n\n之后。"
    );
  });

  it("preserves frontmatter and code blocks", () => {
    const original =
      "---\ntitle: Test\n---\n\nHello.\n\n```js\ncode()\n```\n\nWorld.";
    const units = parseParagraphs(original);
    const translations = ["你好。", "世界。"];

    const result = buildInsertedContent(original, units, translations, "side-by-side");
    expect(result).toContain("---\ntitle: Test\n---");
    expect(result).toContain("```js\ncode()\n```");
    expect(result).toContain("Hello.\n\n你好。");
    expect(result).toContain("World.\n\n世界。");
  });

  it("handles content with no translatable units", () => {
    const original = "---\ntitle: Test\n---\n\n```js\ncode()\n```";
    const units = parseParagraphs(original);
    const translations: string[] = [];

    const result = buildInsertedContent(original, units, translations, "side-by-side");
    expect(result).toBe(original);
  });

  it("defaults to side-by-side when mode is omitted", () => {
    const original = "Hello world.";
    const units = parseParagraphs(original);
    const translations = ["你好世界。"];

    const result = buildInsertedContent(original, units, translations);
    expect(result).toBe("Hello world.\n\n你好世界。");
  });
});

describe("buildInsertedContent — blockquote mode", () => {
  it("converts original paragraphs to blockquotes with translation below", () => {
    const original = "First paragraph.\n\nSecond paragraph.";
    const units = parseParagraphs(original);
    const translations = ["第一段。", "第二段。"];

    const result = buildInsertedContent(original, units, translations, "blockquote");
    expect(result).toBe(
      "> First paragraph.\n\n第一段。\n\n> Second paragraph.\n\n第二段。"
    );
  });

  it("converts heading to blockquote with translated heading below", () => {
    const original = "# Introduction\n\nSome text.";
    const units = parseParagraphs(original);
    const translations = ["介绍", "一些文本。"];

    const result = buildInsertedContent(original, units, translations, "blockquote");
    expect(result).toBe(
      "> # Introduction\n\n# 介绍\n\n> Some text.\n\n一些文本。"
    );
  });

  it("converts multi-line list to blockquote with translated list below", () => {
    const original = "Before.\n\n- Item one\n- Item two\n\nAfter.";
    const units = parseParagraphs(original);
    const translations = ["之前。", "- 第一项\n- 第二项", "之后。"];

    const result = buildInsertedContent(original, units, translations, "blockquote");
    expect(result).toBe(
      "> Before.\n\n之前。\n\n> - Item one\n> - Item two\n\n- 第一项\n- 第二项\n\n> After.\n\n之后。"
    );
  });

  it("preserves frontmatter and code blocks", () => {
    const original =
      "---\ntitle: Test\n---\n\nHello.\n\n```js\ncode()\n```\n\nWorld.";
    const units = parseParagraphs(original);
    const translations = ["你好。", "世界。"];

    const result = buildInsertedContent(original, units, translations, "blockquote");
    expect(result).toContain("---\ntitle: Test\n---");
    expect(result).toContain("```js\ncode()\n```");
    expect(result).toContain("> Hello.\n\n你好。");
    expect(result).toContain("> World.\n\n世界。");
  });
});
