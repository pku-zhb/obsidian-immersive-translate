export type UnitType = "paragraph" | "heading" | "list";

export interface ParagraphUnit {
  type: UnitType;
  raw: string; // Original text including Markdown markers
  text: string; // Text to translate (markers stripped for headings)
  lineStart: number; // Starting line index (0-based)
  lineEnd: number; // Ending line index (0-based, inclusive)
}

export function parseParagraphs(content: string): ParagraphUnit[] {
  if (!content.trim()) return [];

  const lines = content.split("\n");
  const blocks = splitIntoBlocks(lines);
  const units: ParagraphUnit[] = [];

  for (const block of blocks) {
    if (shouldSkip(block.lines)) continue;

    const raw = block.lines.join("\n");
    const firstLine = block.lines[0];

    if (isHeading(firstLine)) {
      const match = firstLine.match(/^(#{1,6})\s+(.+)$/);
      if (match) {
        units.push({
          type: "heading",
          raw,
          text: match[2],
          lineStart: block.start,
          lineEnd: block.end,
        });
      }
    } else if (isList(block.lines)) {
      units.push({
        type: "list",
        raw,
        text: raw,
        lineStart: block.start,
        lineEnd: block.end,
      });
    } else {
      units.push({
        type: "paragraph",
        raw,
        text: raw,
        lineStart: block.start,
        lineEnd: block.end,
      });
    }
  }

  return units;
}

interface Block {
  lines: string[];
  start: number;
  end: number;
}

function splitIntoBlocks(lines: string[]): Block[] {
  const blocks: Block[] = [];
  let current: string[] = [];
  let start = 0;
  let inFrontmatter = false;
  let inCodeBlock = false;
  let inMathBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Frontmatter detection (must be at very start)
    if (i === 0 && trimmed === "---") {
      inFrontmatter = true;
      continue;
    }
    if (inFrontmatter) {
      if (trimmed === "---") {
        inFrontmatter = false;
      }
      continue;
    }

    // Code block detection
    if (trimmed.startsWith("```")) {
      if (!inCodeBlock) {
        if (current.length > 0) {
          blocks.push({ lines: current, start, end: i - 1 });
          current = [];
        }
        inCodeBlock = true;
        continue;
      } else {
        inCodeBlock = false;
        continue;
      }
    }
    if (inCodeBlock) continue;

    // Math block detection
    if (trimmed === "$$") {
      if (!inMathBlock) {
        if (current.length > 0) {
          blocks.push({ lines: current, start, end: i - 1 });
          current = [];
        }
        inMathBlock = true;
        continue;
      } else {
        inMathBlock = false;
        continue;
      }
    }
    if (inMathBlock) continue;

    // Blank line = block separator
    if (trimmed === "") {
      if (current.length > 0) {
        blocks.push({ lines: current, start, end: i - 1 });
        current = [];
      }
      continue;
    }

    if (current.length === 0) {
      start = i;
    }
    current.push(line);
  }

  if (current.length > 0) {
    blocks.push({ lines: current, start, end: start + current.length - 1 });
  }

  return blocks;
}

function shouldSkip(lines: string[]): boolean {
  const first = lines[0].trim();

  // Image
  if (/^!\[.*\]\(.*\)$/.test(first) && lines.length === 1) return true;

  // Embed
  if (/^!\[\[.*\]\]$/.test(first) && lines.length === 1) return true;

  // HTML block
  if (/^<\/?[a-zA-Z]/.test(first)) return true;

  // Callout
  if (/^>\s*\[!/.test(first)) return true;

  // Table (has | at start and a separator line with ---)
  if (first.startsWith("|") && lines.length >= 2) {
    const secondLine = lines[1].trim();
    if (/^\|[\s\-:|]+\|$/.test(secondLine)) return true;
  }

  return false;
}

function isHeading(line: string): boolean {
  return /^#{1,6}\s+/.test(line);
}

function isList(lines: string[]): boolean {
  return /^(\s*[-*+]|\s*\d+\.)\s+/.test(lines[0]);
}
