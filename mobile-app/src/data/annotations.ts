// Highlights are local-first: guests stay entirely on this device, while a
// signed-in user's changes are merged with PostgreSQL through the mobile API.
import { load, save, uid } from "./store";
import { apiRequest } from "./api";

export const HIGHLIGHT_COLORS = ["#FBE59A", "#BFE6CF", "#C7DCF4", "#F3CAD8", "#DDCCF1"];
export const HIGHLIGHTS_CHANGED_EVENT = "ob:highlights-changed";

const LEGACY_HIGHLIGHT_COLORS: Record<string, string> = {
  "#FFD465": "#FBE59A", "#BF78F6": "#DDCCF1", "#E98264": "#F3CAD8",
  "#7FD1AE": "#BFE6CF", "#8FB8E8": "#C7DCF4",
};

export type Highlight = { book: string; chapter: number; verse: number; version?: string; color: string; createdAt: string };
export type Note = { id: string; book: string; chapter: number; verse: number; version?: string; content: string; createdAt: string };
type PendingOperation = { id: string; type: "upsert" | "delete"; book: string; chapter: number; verse: number };
type PendingNoteOperation = { id: string; type: "upsert" | "delete"; noteId: string };

const HL_KEY = "ob.highlights";
const PENDING_KEY = "ob.highlightPendingOps";
const NOTE_KEY = "ob.notes";
const NOTE_PENDING_KEY = "ob.notePendingOps";
const LEGACY_BOOK = "jhn";
let syncPromise: Promise<boolean> | null = null;
let syncTimer: ReturnType<typeof setTimeout> | undefined;
let noteSyncPromise: Promise<boolean> | null = null;
let noteSyncTimer: ReturnType<typeof setTimeout> | undefined;

function notify() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(HIGHLIGHTS_CHANGED_EVENT));
}

function saveHighlights(items: Highlight[]) {
  save(HL_KEY, items);
  notify();
}

function queueOperation(type: PendingOperation["type"], book: string, chapter: number, verse: number) {
  const rest = load<PendingOperation[]>(PENDING_KEY, []).filter((op) => !(op.book === book && op.chapter === chapter && op.verse === verse));
  save(PENDING_KEY, [...rest, { id: uid(), type, book, chapter, verse }]);
}

function scheduleSync() {
  if (typeof window === "undefined") return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => { void syncHighlights(); }, 350);
}

export function getHighlights(): Highlight[] {
  return load<Highlight[]>(HL_KEY, []).map((h) => ({
    ...h,
    book: h.book ?? LEGACY_BOOK,
    color: LEGACY_HIGHLIGHT_COLORS[h.color] ?? h.color,
  }));
}

export function setHighlight(book: string, chapter: number, verse: number, color: string, version?: string) {
  const rest = getHighlights().filter((h) => !(h.book === book && h.chapter === chapter && h.verse === verse));
  saveHighlights([...rest, { book, chapter, verse, version, color, createdAt: new Date().toISOString() }]);
  queueOperation("upsert", book, chapter, verse);
  scheduleSync();
}

export function clearHighlight(book: string, chapter: number, verse: number) {
  saveHighlights(getHighlights().filter((h) => !(h.book === book && h.chapter === chapter && h.verse === verse)));
  queueOperation("delete", book, chapter, verse);
  scheduleSync();
}

export function syncHighlights(): Promise<boolean> {
  if (syncPromise) return syncPromise;
  syncPromise = (async () => {
    const operations = load<PendingOperation[]>(PENDING_KEY, []);
    const sentIds = new Set(operations.map((op) => op.id));
    const local = getHighlights();
    try {
      const response = await apiRequest<{ highlights?: Highlight[] }>(
        "/api/mobile/highlights",
        {
          method: "POST",
          body: {
            highlights: local,
            deletions: operations.filter((op) => op.type === "delete").map(({ book, chapter, verse }) => ({ book, chapter, verse })),
          },
        },
      );
      if (response.status === 401) return false;
      if (!response.ok) return false;
      if (!Array.isArray(response.data?.highlights)) return false;

      const remaining = load<PendingOperation[]>(PENDING_KEY, []).filter((op) => !sentIds.has(op.id));
      save(PENDING_KEY, remaining);
      let merged = response.data.highlights.map((item) => ({ ...item, createdAt: String(item.createdAt) }));
      for (const op of remaining) {
        if (op.type === "delete") merged = merged.filter((h) => !(h.book === op.book && h.chapter === op.chapter && h.verse === op.verse));
        else {
          const localItem = getHighlights().find((h) => h.book === op.book && h.chapter === op.chapter && h.verse === op.verse);
          if (localItem) merged = [...merged.filter((h) => !(h.book === op.book && h.chapter === op.chapter && h.verse === op.verse)), localItem];
        }
      }
      saveHighlights(merged);
      if (remaining.length) scheduleSync();
      return true;
    } catch {
      return false;
    }
  })().finally(() => { syncPromise = null; });
  return syncPromise;
}

export function clearHighlightsForLogout() {
  clearTimeout(syncTimer);
  save(PENDING_KEY, []);
  saveHighlights([]);
}

export function getNotes(): Note[] {
  return load<Note[]>(NOTE_KEY, []).map((n) => ({ ...n, book: n.book ?? LEGACY_BOOK }));
}

function saveNotes(notes: Note[]) {
  save(NOTE_KEY, notes);
  notify();
}

function queueNoteOperation(type: PendingNoteOperation["type"], noteId: string) {
  const rest = load<PendingNoteOperation[]>(NOTE_PENDING_KEY, [])
    .filter((operation) => operation.noteId !== noteId);
  save(NOTE_PENDING_KEY, [...rest, { id: uid(), type, noteId }]);
}

function scheduleNoteSync() {
  if (typeof window === "undefined") return;
  clearTimeout(noteSyncTimer);
  noteSyncTimer = setTimeout(() => { void syncNotes(); }, 350);
}

export function addNote(book: string, chapter: number, verse: number, content: string, version?: string) {
  const note: Note = { id: uid(), book, chapter, verse, version, content, createdAt: new Date().toISOString() };
  saveNotes([note, ...getNotes()]);
  queueNoteOperation("upsert", note.id);
  scheduleNoteSync();
  return note;
}

export function updateNote(id: string, content: string) {
  const notes = getNotes();
  const current = notes.find((note) => note.id === id);
  if (!current) return null;
  const updated = { ...current, content };
  saveNotes(notes.map((note) => note.id === id ? updated : note));
  queueNoteOperation("upsert", id);
  scheduleNoteSync();
  return updated;
}

export function deleteNote(id: string) {
  saveNotes(getNotes().filter((note) => note.id !== id));
  queueNoteOperation("delete", id);
  scheduleNoteSync();
}

export function syncNotes(): Promise<boolean> {
  if (noteSyncPromise) return noteSyncPromise;
  noteSyncPromise = (async () => {
    const operations = load<PendingNoteOperation[]>(NOTE_PENDING_KEY, []);
    const sentIds = new Set(operations.map((operation) => operation.id));
    try {
      const response = await apiRequest<{ notes?: Note[] }>("/api/mobile/notes", {
        method: "POST",
        body: {
          notes: getNotes(),
          deletions: operations
            .filter((operation) => operation.type === "delete")
            .map((operation) => operation.noteId),
        },
      });
      if (response.status === 401 || !response.ok || !Array.isArray(response.data?.notes)) {
        return false;
      }

      const remaining = load<PendingNoteOperation[]>(NOTE_PENDING_KEY, [])
        .filter((operation) => !sentIds.has(operation.id));
      save(NOTE_PENDING_KEY, remaining);
      let merged = response.data.notes.map((note) => ({
        ...note,
        createdAt: String(note.createdAt),
      }));
      for (const operation of remaining) {
        if (operation.type === "delete") {
          merged = merged.filter((note) => note.id !== operation.noteId);
          continue;
        }
        const local = getNotes().find((note) => note.id === operation.noteId);
        if (local) merged = [local, ...merged.filter((note) => note.id !== local.id)];
      }
      saveNotes(merged);
      if (remaining.length) scheduleNoteSync();
      return true;
    } catch {
      return false;
    }
  })().finally(() => { noteSyncPromise = null; });
  return noteSyncPromise;
}
