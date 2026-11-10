import type { IndexEntry } from "../types";

/** Связанные уроки конспекта: TF-IDF по усечённым до 6 букв словам (грубый стемминг для русского). */
const STOP = new Set("котор может можно котор использ являет должен необход только всегда случае какой каким какие каких этого через между после перед также более менее данны".split(" "));

function terms(text: string) {
  const out: string[] = [];
  for (const w of text.toLowerCase().replace(/ё/g, "е").match(/[a-zа-я]{4,}/g) ?? []) {
    const t = w.slice(0, 6);
    if (!STOP.has(t)) out.push(t);
  }
  return out;
}

interface Doc { entry: IndexEntry; vec: Map<string, number>; norm: number }
let model: { docs: Doc[]; idf: Map<string, number> } | null = null;
let modelFor: IndexEntry[] | null = null;

function build(index: IndexEntry[]) {
  const df = new Map<string, number>();
  const tfs = index.map((e) => {
    const tf = new Map<string, number>();
    for (const t of terms(`${e.title} ${e.title} ${e.text}`)) tf.set(t, (tf.get(t) ?? 0) + 1);
    for (const t of tf.keys()) df.set(t, (df.get(t) ?? 0) + 1);
    return tf;
  });
  const idf = new Map([...df].map(([t, n]) => [t, Math.log(index.length / n)]));
  const docs = tfs.map((tf, i) => {
    const vec = new Map([...tf].map(([t, n]) => [t, (1 + Math.log(n)) * (idf.get(t) ?? 0)]));
    return { entry: index[i], vec, norm: Math.hypot(...vec.values()) || 1 };
  });
  return { docs, idf };
}

export function relatedLessons(index: IndexEntry[], text: string, limit = 3) {
  if (modelFor !== index) { model = build(index); modelFor = index; }
  const { docs, idf } = model!;
  const tf = new Map<string, number>();
  for (const t of terms(text)) tf.set(t, (tf.get(t) ?? 0) + 1);
  const q = new Map([...tf].map(([t, n]) => [t, (1 + Math.log(n)) * (idf.get(t) ?? 0)]));
  const qn = Math.hypot(...q.values()) || 1;
  return docs
    .map((d) => {
      let dot = 0;
      for (const [t, w] of q) dot += w * (d.vec.get(t) ?? 0);
      return { entry: d.entry, score: dot / qn / d.norm };
    })
    .filter((x) => x.score > 0.06)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.entry);
}
