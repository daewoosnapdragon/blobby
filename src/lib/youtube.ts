/** An 11-character YouTube video id. */
export const YOUTUBE_ID_RE = /^[A-Za-z0-9_-]{11}$/;

const HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com']);

/** Pulls the video id out of a youtu.be, watch?v=, shorts, or embed link, or a bare id. null when it is none of those. */
export function parseYouTubeId(input: string): string | null {
  const raw = input.trim();
  if (YOUTUBE_ID_RE.test(raw)) return raw;
  let u: URL;
  try {
    u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase();
  let id: string | null | undefined;
  if (host === 'youtu.be' || host === 'www.youtu.be') {
    id = u.pathname.split('/')[1];
  } else if (HOSTS.has(host)) {
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts[0] === 'watch') id = u.searchParams.get('v');
    else if (parts[0] === 'shorts' || parts[0] === 'embed') id = parts[1];
  }
  return id && YOUTUBE_ID_RE.test(id) ? id : null;
}

export type EmbedCheck =
  | { ok: true; id: string }
  | { ok: false; reason: 'not_found' | 'not_embeddable' | 'bad_url' | 'unreachable' };

/**
 * Asks YouTube's oEmbed whether the video can be played inside the app (spec 6).
 * 200 ok; 401/403 the owner turned embedding off; 400/404 no such (or private) video;
 * 'unreachable' (our addition) when YouTube could not be reached at all or answered something unexpected.
 */
export async function checkEmbeddable(urlOrId: string): Promise<EmbedCheck> {
  const id = parseYouTubeId(urlOrId);
  if (!id) return { ok: false, reason: 'bad_url' };
  try {
    const url = `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}&format=json`;
    const res = await fetch(url);
    if (res.status === 200) return { ok: true, id };
    if (res.status === 401 || res.status === 403) return { ok: false, reason: 'not_embeddable' };
    if (res.status === 404 || res.status === 400) return { ok: false, reason: 'not_found' };
    return { ok: false, reason: 'unreachable' };
  } catch {
    return { ok: false, reason: 'unreachable' };
  }
}
