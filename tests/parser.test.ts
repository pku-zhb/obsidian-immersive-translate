import { describe, it, expect } from "vitest";
import { parseParagraphs, ParagraphUnit } from "../src/parser";

describe("parseParagraphs", () => {
  it("splits plain text into paragraphs by blank lines", () => {
    const input = "First paragraph.\n\nSecond paragraph.";
    const result = parseParagraphs(input);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      type: "paragraph",
      raw: "First paragraph.",
      text: "First paragraph.",
      lineStart: 0,
      lineEnd: 0,
    });
    expect(result[1]).toEqual({
      type: "paragraph",
      raw: "Second paragraph.",
      text: "Second paragraph.",
      lineStart: 2,
      lineEnd: 2,
    });
  });

  it("skips frontmatter", () => {
    const input = "---\ntitle: Test\n---\n\nActual content.";
    const result = parseParagraphs(input);
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe("Actual content.");
  });

  it("skips code blocks", () => {
    const input =
      "Before code.\n\n```python\nprint('hello')\n```\n\nAfter code.";
    const result = parseParagraphs(input);
    expect(result).toHaveLength(2);
    expect(result[0].text).toBe("Before code.");
    expect(result[1].text).toBe("After code.");
  });

  it("skips math blocks", () => {
    const input = "Before math.\n\n$$\nE = mc^2\n$$\n\nAfter math.";
    const result = parseParagraphs(input);
    expect(result).toHaveLength(2);
    expect(result[0].text).toBe("Before math.");
    expect(result[1].text).toBe("After math.");
  });

  it("skips tables", () => {
    const input =
      "Before table.\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n\nAfter table.";
    const result = parseParagraphs(input);
    expect(result).toHaveLength(2);
    expect(result[0].text).toBe("Before table.");
    expect(result[1].text).toBe("After table.");
  });

  it("skips callouts", () => {
    const input = "Before.\n\n> [!note]\n> This is a callout.\n\nAfter.";
    const result = parseParagraphs(input);
    expect(result).toHaveLength(2);
    expect(result[0].text).toBe("Before.");
    expect(result[1].text).toBe("After.");
  });

  it("skips image lines", () => {
    const input = "Before.\n\n![alt](image.png)\n\nAfter.";
    const result = parseParagraphs(input);
    expect(result).toHaveLength(2);
    expect(result[0].text).toBe("Before.");
    expect(result[1].text).toBe("After.");
  });

  it("skips embeds", () => {
    const input = "Before.\n\n![[other-note]]\n\nAfter.";
    const result = parseParagraphs(input);
    expect(result).toHaveLength(2);
    expect(result[0].text).toBe("Before.");
    expect(result[1].text).toBe("After.");
  });

  it("parses headings with type heading", () => {
    const input = "# Introduction\n\nSome text.";
    const result = parseParagraphs(input);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      type: "heading",
      raw: "# Introduction",
      text: "Introduction",
    });
  });

  it("parses list blocks as a single unit", () => {
    const input =
      "Before.\n\n- Item one\n- Item two\n- Item three\n\nAfter.";
    const result = parseParagraphs(input);
    expect(result).toHaveLength(3);
    expect(result[1]).toMatchObject({
      type: "list",
      raw: "- Item one\n- Item two\n- Item three",
      text: "- Item one\n- Item two\n- Item three",
    });
  });

  it("parses ordered list blocks", () => {
    const input = "Before.\n\n1. First\n2. Second\n\nAfter.";
    const result = parseParagraphs(input);
    expect(result).toHaveLength(3);
    expect(result[1].type).toBe("list");
  });

  it("returns empty array for empty input", () => {
    expect(parseParagraphs("")).toEqual([]);
    expect(parseParagraphs("---\ntitle: X\n---")).toEqual([]);
  });

  it("skips HTML blocks", () => {
    const input = "Before.\n\n<div>some html</div>\n\nAfter.";
    const result = parseParagraphs(input);
    expect(result).toHaveLength(2);
    expect(result[0].text).toBe("Before.");
    expect(result[1].text).toBe("After.");
  });
});
