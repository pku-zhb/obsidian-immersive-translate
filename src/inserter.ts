import type { ParagraphUnit } from "./parser";

/**
 * Builds new content with translations inserted after corresponding original paragraphs.
 * Works by processing units from bottom to top to preserve line offsets.
 */
export function buildInsertedContent(
  originalContent: string,
  units: ParagraphUnit[],
  translations: string[]
): string {
  if (units.length === 0 || translations.length === 0) return originalContent;

  const lines = originalContent.split("\n");

  // Process from bottom to top so line numbers remain valid
  for (let i = units.length - 1; i >= 0; i--) {
    const unit = units[i];
    const translation = translations[i];
    if (!translation) continue;

    if (unit.type === "heading") {
      // Insert translated heading directly below original heading (same line group)
      const headingMatch = unit.raw.match(/^(#{1,6})\s+/);
      const prefix = headingMatch ? headingMatch[1] : "#";
      const translatedLine = `${prefix} ${translation}`;
      lines.splice(unit.lineEnd + 1, 0, translatedLine);
    } else {
      // Insert translated block after the original block with a blank line separator
      const translatedLines = translation.split("\n");
      lines.splice(unit.lineEnd + 1, 0, "", ...translatedLines);
    }
  }

  return lines.join("\n");
}
