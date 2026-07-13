// Per-device highlights & notes, persisted to localStorage.
import { load, save, uid } from "./store";

export const HIGHLIGHT_COLORS = ["#FFD465", "#BF78F6", "#E98264", "#7FD1AE", "#8FB8E8"];

export type Highlight = { chapter: number; verse: number; color: string; createdAt: string };
export type Note = { id: string; chapter: number; verse: number; content: string; createdAt: string };

const HL_KEY = "ob.highlights";
const NOTE_KEY = "ob.notes";

// Ships with the design's sample highlight on 3:16 / 3:19 the first time.
const DEFAULT_HIGHLIGHTS: Highlight[] = [
  { chapter: 3, verse: 16, color: "#FFD465", createdAt: new Date().toISOString() },
  { chapter: 3, verse: 19, color: "#FFD465", createdAt: new Date().toISOString() },
];

export function getHighlights(): Highlight[] {
  return load<Highlight[]>(HL_KEY, DEFAULT_HIGHLIGHTS);
}

export function setHighlight(chapter: number, verse: number, color: string) {
  const rest = getHighlights().filter((h) => !(h.chapter === chapter && h.verse === verse));
  save(HL_KEY, [...rest, { chapter, verse, color, createdAt: new Date().toISOString() }]);
}

export function clearHighlight(chapter: number, verse: number) {
  save(HL_KEY, getHighlights().filter((h) => !(h.chapter === chapter && h.verse === verse)));
}

export function getNotes(): Note[] {
  return load<Note[]>(NOTE_KEY, []);
}

export function addNote(chapter: number, verse: number, content: string) {
  const note: Note = { id: uid(), chapter, verse, content, createdAt: new Date().toISOString() };
  save(NOTE_KEY, [note, ...getNotes()]);
  return note;
}
