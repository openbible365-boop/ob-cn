import * as OpenCC from "opencc-js";

let s2tConverter: ((text: string) => string) | null = null;

export function translateToTraditional(text: string): string {
  if (!s2tConverter) {
    try {
      s2tConverter = OpenCC.Converter({ from: "cn", to: "t" });
    } catch (e) {
      console.error("Failed to initialize OpenCC converter", e);
      return text;
    }
  }
  return s2tConverter ? s2tConverter(text) : text;
}
