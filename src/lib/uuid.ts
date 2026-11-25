// One UUID check for every layer (roster import, DB lookups, API validation).
// Deliberately any 8-4-4-4-12 hex id, not only RFC-versioned ones: the school export decides what ids look like.
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
