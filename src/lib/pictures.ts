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

/** Past and other verb forms that would match a picture by accident ("ate" -> pizza). Not nouns, so never suggested. */
const VERBS = new Set(`ate ran went saw drew came took sat made found gave got had said told thought knew began became caught
brought chose held built felt kept left meant drank threw fell wrote rode flew swam sang sold bought taught heard read
lost won met paid put let set cut hit hurt shut sent spent stood understood woke wore broke spoke stole drove`.split(/\s+/));

function words(text: string): string[] {
  return (text.toLowerCase().match(/[a-z]+/g) ?? [])
    .filter((w) => w.length > 1 && !STOP.has(w) && !VERBS.has(w) && !/(ed|ing)$/.test(w));
}

/** Everyday words whose obvious picture isn't the one with that exact name (kids' vocabulary). */
const EVERYDAY: Record<string, string> = {
  car: 'automobile', book: 'closed-book', apple: 'red-apple', bike: 'bicycle', kid: 'child', ball: 'soccer-ball',
  phone: 'mobile-phone', computer: 'laptop', tv: 'television', house: 'house', home: 'house', mom: 'woman', dad: 'man',
  teacher: 'teacher', plane: 'airplane', hat: 'billed-cap', shoe: 'running-shoe', present: 'wrapped-gift', gift: 'wrapped-gift',
  sun: 'sun', moon: 'crescent-moon', flower: 'tulip', tree: 'deciduous-tree', cake: 'birthday-cake', water: 'droplet',
};

/** How well a picture fits one word: 5 everyday picture, 4 its name, 3 in its name and keywords, 2 a keyword, 1 in its name. */
function fit(p: PictureEntry, word: string): number {
  if (EVERYDAY[word] === p.n) return 5;
  if (p.n === word) return 4;
  const inName = p.n.split('-').includes(word);
  const inKeywords = p.k.includes(word);
  if (inName && inKeywords) return 3;
  if (inKeywords) return 2;
  return inName ? 1 : 0;
}

/** One word's matches, best first; among equals the plainest picture (fewest name parts, then shortest). */
function forWord(catalog: PictureEntry[], word: string): PictureEntry[] {
  return catalog
    .map((p) => ({ p, f: fit(p, word) }))
    .filter((x) => x.f > 0)
    .sort((a, b) => b.f - a.f || a.p.n.split('-').length - b.p.n.split('-').length || a.p.n.length - b.p.n.length)
    .map((x) => x.p);
}

/**
 * The strongest matches first, across all the words (everyday and exact names before keyword matches); within a
 * strength, each word's best before anyone's second; then word order. So every noun gets its best picture early.
 */
function ranked(catalog: PictureEntry[], terms: string[], n: number): PictureEntry[] {
  const cands: { p: PictureEntry; f: number; rank: number; term: number }[] = [];
  terms.forEach((t, term) => forWord(catalog, t).forEach((p, rank) => cands.push({ p, f: fit(p, t), rank, term })));
  cands.sort((a, b) => b.f - a.f || a.rank - b.rank || a.term - b.term);
  const out: PictureEntry[] = [];
  const seen = new Set<string>();
  for (const c of cands) {
    if (seen.has(c.p.n)) continue;
    seen.add(c.p.n);
    out.push(c.p);
    if (out.length >= n) break;
  }
  return out;
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
