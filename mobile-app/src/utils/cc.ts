import * as OpenCC from "opencc-js";

let simplifiedToTraditional: ((text: string) => string) | null = null;

export function translateToTraditional(text: string): string {
  if (!simplifiedToTraditional) {
    try {
      simplifiedToTraditional = OpenCC.Converter({ from: "cn", to: "t" });
    } catch (error) {
      console.error("Failed to initialize OpenCC converter", error);
      return text;
    }
  }
  return simplifiedToTraditional(text);
}
