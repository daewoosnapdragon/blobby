// Usage: npx tsx scripts/build-pictures.ts
// Writes the question-picture set from Noto Color Emoji (Google, Apache 2.0) to public/pictures/:
// one SVG per everyday picture (no flags, skin tones or keycaps), catalog.json for the editor's search
// (name, label, Unicode CLDR keywords from emojibase), and the license notice. Output is committed; rerun
// only to change the set.
import fs from 'node:fs';
import path from 'node:path';
import type { PictureEntry } from '../src/lib/pictures';

const OUT = path.resolve(__dirname, '../public/pictures');
const noto = JSON.parse(fs.readFileSync(require.resolve('@iconify-json/noto/icons.json'), 'utf8')) as {
  icons: Record<string, { body: string; width?: number; height?: number; left?: number; top?: number }>;
  width?: number; height?: number;
};
const emojis = JSON.parse(fs.readFileSync(require.resolve('emojibase-data/en/data.json'), 'utf8')) as { label: string; tags?: string[] }[];

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const tagsByName = new Map(emojis.map((e) => [slug(e.label), (e.tags ?? []).map((t) => t.toLowerCase())]));

const skip = (n: string) =>
  n.startsWith('flag-') || n.includes('-tone') || n.startsWith('keycap') || n.startsWith('regional-indicator') || /^[0-9]$/.test(n);

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const catalog: PictureEntry[] = [];
for (const [name, icon] of Object.entries(noto.icons).sort(([a], [b]) => a.localeCompare(b))) {
  if (skip(name)) continue;
  const w = icon.width ?? noto.width ?? 128, h = icon.height ?? noto.height ?? 128;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${icon.left ?? 0} ${icon.top ?? 0} ${w} ${h}">${icon.body}</svg>`;
  fs.writeFileSync(path.join(OUT, `${name}.svg`), svg);
  const words = new Set([...(tagsByName.get(name) ?? [])].flatMap((t) => t.split(/[^a-z0-9]+/)).filter((t) => t.length > 1));
  catalog.push({ n: name, l: name.replace(/-/g, ' '), k: [...words] });
}
fs.writeFileSync(path.join(OUT, 'catalog.json'), JSON.stringify(catalog));
fs.writeFileSync(path.join(OUT, 'LICENSE.txt'),
  'Pictures from Noto Emoji by Google (https://github.com/googlefonts/noto-emoji), via @iconify-json/noto.\n' +
  'Licensed under the Apache License, Version 2.0: https://www.apache.org/licenses/LICENSE-2.0\n' +
  'Keywords from emojibase-data (MIT), based on Unicode CLDR annotations.\n');
console.log(`${catalog.length} pictures, ${catalog.filter((c) => c.k.length).length} with keywords`);
