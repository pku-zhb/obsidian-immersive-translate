export interface TranslationEngine {
  name: string;
  translate(text: string, from: string, to: string): Promise<string>;
}
