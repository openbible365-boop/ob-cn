// Per-device highlights & notes, persisted to localStorage.
// Records are keyed by book code + chapter + verse; records written before
// multi-book support have no `book` and are treated as 约翰福音 ("jhn").
import { load, save, uid } from "./store";

export const HIGHLIGHT_COLORS = ["#FFD465", "#BF78F6", "#E98264", "#7FD1AE", "#8FB8E8"];

export type Highlight = { book: string; chapter: number; verse: number; color: string; createdAt: string };
export type Note = { id: string; book: string; chapter: number; verse: number; content: string; createdAt: string };

const HL_KEY = "ob.highlights";
const NOTE_KEY = "ob.notes";
const LEGACY_BOOK = "jhn";

// Ships with the design's sample highlight on 3:16 / 3:19 the first time.
const DEFAULT_HIGHLIGHTS: Highlight[] = [
  { book: LEGACY_BOOK, chapter: 3, verse: 16, color: "#FFD465", createdAt: new Date().toISOString() },
  { book: LEGACY_BOOK, chapter: 3, verse: 19, color: "#FFD465", createdAt: new Date().toISOString() },
];

export function getHighlights(): Highlight[] {
  return load<Highlight[]>(HL_KEY, DEFAULT_HIGHLIGHTS).map((h) => ({ ...h, book: h.book ?? LEGACY_BOOK }));
}

export function setHighlight(book: string, chapter: number, verse: number, color: string) {
  const rest = getHighlights().filter((h) => !(h.book === book && h.chapter === chapter && h.verse === verse));
  save(HL_KEY, [...rest, { book, chapter, verse, color, createdAt: new Date().toISOString() }]);
}

export function clearHighlight(book: string, chapter: number, verse: number) {
  save(HL_KEY, getHighlights().filter((h) => !(h.book === book && h.chapter === chapter && h.verse === verse)));
}

export function getNotes(): Note[] {
  return load<Note[]>(NOTE_KEY, []).map((n) => ({ ...n, book: n.book ?? LEGACY_BOOK }));
}

export function addNote(book: string, chapter: number, verse: number, content: string) {
  const note: Note = { id: uid(), book, chapter, verse, content, createdAt: new Date().toISOString() };
  save(NOTE_KEY, [note, ...getNotes()]);
  return note;
}
