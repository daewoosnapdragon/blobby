// Grammar skills, by key. Questions, the review bank and each kid's review track all refer to these keys.
// label: how Kyla sees it; kid: the words on kid screens ("Tricky today: past tense (went, played)").

export const SKILLS = {
  // the 8 Picture Detective error groups
  'be': { label: 'am / is / are', kid: 'am, is, are' },
  'ing': { label: 'is / are + -ing', kid: 'is reading, are playing' },
  'sentence-ends': { label: 'Capitals and periods', kid: 'capital letters and periods' },
  'articles': { label: 'a / an / the', kid: 'a, an, the' },
  'plurals': { label: 'Plurals', kid: 'one and more than one' },
  'past-tense': { label: 'Past tense', kid: 'past tense (played, walked)' },
  'third-person-s': { label: 'he / she + -s', kid: 'he likes, she runs' },
  'prepositions': { label: 'Small words after verbs (to, at, in)', kid: 'to, at, in' },
  // more skills from the lessons and the workbooks' next steps
  'capitals-names': { label: 'Capital letters for names', kid: 'capital letters for names' },
  'there-is-are': { label: 'there is / there are', kid: 'there is, there are' },
  'was-were': { label: 'was / were', kid: 'was, were' },
  'irregular-past': { label: 'Irregular past verbs', kid: 'tricky past words (went, saw, ate)' },
  'did-didnt': { label: "did / didn't + verb", kid: "didn't go, did you see" },
  'irregular-plurals': { label: 'Irregular plurals', kid: 'children, mice, feet' },
  'comparatives': { label: '-er / -est, better / best', kid: 'bigger, biggest, better, best' },
  'agreement': { label: 'Verb agreement', kid: 'the kids were, the teacher was' },
  'compound-comma': { label: 'Comma before and / but / so', kid: 'a comma before and, but, so' },
  'comma-splice': { label: 'No comma splices or run-ons', kid: 'ending one sentence before the next' },
  'fragments': { label: 'Complete sentences', kid: 'complete sentences' },
  'because-when': { label: 'because / when sentences', kid: 'because and when' },
  'opening-clause-comma': { label: 'Comma after an opening clause', kid: 'When the bell rang, …' },
  'apostrophes': { label: "Apostrophes ('s)", kid: "Mia's bag" },
  'dialogue': { label: 'Dialogue punctuation', kid: 'talking marks' },
  'adverbs': { label: '-ly words', kid: 'slowly, quietly' },
  'place-words': { label: 'Place words (in, on, under, next to)', kid: 'in, on, under, next to' },
} as const satisfies Record<string, { label: string; kid: string }>;

export type SkillKey = keyof typeof SKILLS;
export const SKILL_KEYS = Object.keys(SKILLS) as SkillKey[];

export function isSkillKey(x: unknown): x is SkillKey {
  return typeof x === 'string' && Object.hasOwn(SKILLS, x);
}
