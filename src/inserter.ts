import type { ParagraphUnit } from "./parser";
import type { InsertMode } from "./settings";

/**
 * Builds new content with translations inserted.
 * Two modes:
 * - "side-by-side": translation inserted after original (original unchanged)
 * - "blockquote": original converted to blockquote, translation below in original format
 */
export function buildInsertedContent(
  originalContent: string,
  units: ParagraphUnit[],
  translations: string[],
  mode: InsertMode = "side-by-side"
): string {
  if (units.length === 0 || translations.length === 0) return originalContent;

  const lines = originalContent.split("\n");

  // Process from bottom to top so line numbers remain valid
  for (let i = units.length - 1; i >= 0; i--) {
    const unit = units[i];
    const translation = translations[i];
    if (!translation) continue;

    if (mode === "blockquote") {
      insertBlockquote(lines, unit, translation);
    } else {
      insertSideBySide(lines, unit, translation);
    }
  }

  return lines.join("\n");
}

function insertSideBySide(
  lines: string[],
  unit: ParagraphUnit,
  translation: string
): void {
  if (unit.type === "heading") {
    const headingMatch = unit.raw.match(/^(#{1,6})\s+/);
    const prefix = headingMatch ? headingMatch[1] : "#";
    const translatedLine = `${prefix} ${translation}`;
    lines.splice(unit.lineEnd + 1, 0, translatedLine);
  } else {
    const translatedLines = translation.split("\n");
    lines.splice(unit.lineEnd + 1, 0, "", ...translatedLines);
  }
}

function insertBlockquote(
  lines: string[],
  unit: ParagraphUnit,
  translation: string
): void {
  // Convert original lines to blockquote
  const originalLines: string[] = [];
  for (let j = unit.lineStart; j <= unit.lineEnd; j++) {
    originalLines.push(`> ${lines[j]}`);
  }

  // Build replacement: blockquoted original + blank line + translation
  let translatedText = translation;
  if (unit.type === "heading") {
    const headingMatch = unit.raw.match(/^(#{1,6})\s+/);
    const prefix = headingMatch ? headingMatch[1] : "#";
    translatedText = `${prefix} ${translation}`;
  }

  const translatedLines = translatedText.split("\n");
  const replacement = [...originalLines, "", ...translatedLines];

  // Replace original lines with blockquoted original + translation
  const count = unit.lineEnd - unit.lineStart + 1;
  lines.splice(unit.lineStart, count, ...replacement);
}
