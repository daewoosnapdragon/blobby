export const BLOB_COLOR_KEYS = ['sunny', 'peach', 'pink', 'mint', 'sky', 'grape'] as const;
export type BlobColorKey = (typeof BLOB_COLOR_KEYS)[number];

/** A stored blob_color (or null / junk) as a usable key; kids who haven't picked yet are Sunny. */
export function toBlobColor(c: string | null | undefined): BlobColorKey {
  return BLOB_COLOR_KEYS.includes(c as BlobColorKey) ? (c as BlobColorKey) : 'sunny';
}

export const BLOB_NAMES: Record<BlobColorKey, string> = {
  sunny: 'Sunny', peach: 'Peach', pink: 'Pink', mint: 'Mint', sky: 'Sky', grape: 'Grape',
};
