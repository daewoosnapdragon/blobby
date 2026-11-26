// Question pictures (Noto Color Emoji, shipped under public/pictures). Pure and client-safe:
// the editor fetches /pictures/catalog.json once and matches with these.

/** One picture: n = file name (and what a question stores), l = label, k = keywords (Unicode CLDR). */
export type PictureEntry = { n: string; l: string; k: string[] };

export const PICTURE_NAME_RE = /^[a-z0-9-]{1,64}$/;

export function pictureSrc(name: string): string {
  return `/pictures/${name}.svg`;
}

const IRREGULAR: Record<string, string> = {
  mice: 'mouse', children: 'child', feet: 'foot', teeth: 'tooth', people: 'person', men: 'man', women: 'woman',
  geese: 'goose', oxen: 'ox', leaves: 'leaf', wolves: 'wolf', knives: 'knife', loaves: 'loaf', shelves: 'shelf',
};
const NO_S = new Set(['bus', 'glass', 'grass', 'class', 'dress', 'boss', 'gas', 'octopus', 'cactus', 'news', 'chess', 'kiss', 'bonus']);

/** A word's singular, for matching "mice" to the mouse picture. Good enough for kids' nouns, not a full stemmer. */
export function singular(word: string): string {
  const w = word.toLowerCase();
  if (IRREGULAR[w]) return IRREGULAR[w];
  if (NO_S.has(w) || w.length <= 3) return w;
  if (w.endsWith('ies')) return `${w.slice(0, -3)}y`;
  if (/(ches|shes|xes|sses|zes|oes)$/.test(w)) return w.slice(0, -2);
  if (w.endsWith('s') && !w.endsWith('ss') && !w.endsWith('us')) return w.slice(0, -1);
  return w;
}

/** Words that never name a picture worth suggesting (articles, be-verbs, pronouns, colors on their own). */
const STOP = new Set(`a an the is am are was were be been being i you he she it we they me him her us them my your his its our their
this that these those there here and or but so because when if to of in on at by for with from up down out over under
do does did done have has had not no yes very too can could will would should may might must just also than then
some any many much more most one two three four five six seven eight nine ten first last next every each all
red orange yellow green blue purple pink brown black white gray grey big small little new old good bad happy sad
today yesterday tomorrow now later always never again what who where why how which right wrong`.split(/\s+/));

function words(text: string): string[] {
  return (text.toLowerCase().match(/[a-z]+/g) ?? []).filter((w) => w.length > 1 && !STOP.has(w));
}

/** How well a picture fits one word: 3 = its name, 2 = a word of its name, 1 = a keyword; 0 = no match. */
function fit(p: PictureEntry, word: string): number {
  if (p.n === word) return 3;
  if (p.n.split('-').includes(word)) return 2;
  if (p.k.includes(word)) return 1;
  return 0;
}

function ranked(catalog: PictureEntry[], terms: string[], n: number): PictureEntry[] {
  const scores = new Map<string, { p: PictureEntry; score: number; order: number }>();
  terms.forEach((t, ti) => {
    for (const p of catalog) {
      const f = fit(p, t);
      if (!f) continue;
      // Earlier words in the text win ties; shorter names (the plain thing, not a variant) next.
      const score = f * 100 - ti;
      const prev = scores.get(p.n);
      if (!prev || score > prev.score) scores.set(p.n, { p, score, order: p.n.length });
    }
  });
  return [...scores.values()].sort((a, b) => b.score - a.score || a.order - b.order).slice(0, n).map((x) => x.p);
}

/** Pictures for the nouns in a question's text, best first. */
export function suggestPictures(text: string, catalog: PictureEntry[], n = 4): PictureEntry[] {
  const terms = [...new Set(words(text).map(singular))];
  return ranked(catalog, terms, n);
}

/** Keyword search: whole-word matches first, then pictures whose name or keyword starts with the query. */
export function searchPictures(query: string, catalog: PictureEntry[], n = 24): PictureEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const term = singular(q);
  const exact = ranked(catalog, [term], n);
  if (exact.length >= n) return exact;
  const seen = new Set(exact.map((p) => p.n));
  const starts = catalog.filter((p) => !seen.has(p.n) && (p.n.startsWith(q) || p.n.split('-').some((w) => w.startsWith(q)) || p.k.some((k) => k.startsWith(q))));
  return [...exact, ...starts].slice(0, n);
}
