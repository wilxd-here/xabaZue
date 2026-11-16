// Relevansi katalog artis: normalisasi, pencocokan identitas, scoring, dedup.
export const norm = s => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .replace(/&amp;|&#39;|&quot;/g, " ").replace(/[^a-z0-9]+/g, " ").trim();
const hasWords = (hay, needle) => needle && (" " + hay + " ").includes(" " + needle + " ");
const BAD = /\b(cover|karaoke|reaction|react|tutorial|instrumental|nightcore|slowed|sped up|speed up|parody|parodi|8d|compilation|kompilasi|full album|jam session|cover by|ukulele|piano version)\b/;
const COLLAB = /\b(feat|ft|featuring|with|x)\b|&/;
const NOISE = /\b(official|video|music|musik|lyric|lyrics|lirik|audio|mv|hd|hq|clip|klip|visualizer|live|session)\b/g;
const CH_OK = /\b(official|topic|vevo|music|records|entertainment|channel)\b/;
const decode = s => String(s || "").replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"');

export function simplify(item) {
  const s = item.snippet || {};
  const t = s.thumbnails || {};
  return { id: item.id?.videoId, title: decode(s.title), channel: decode(s.channelTitle),
    thumb: (t.high || t.medium || t.default || {}).url || "", published: s.publishedAt || "" };
}

// Skor >= 0 berarti relevan; -1 berarti dibuang.
export function scoreItem(track, artist) {
  const title = norm(track.title), ch = norm(track.channel);
  if (BAD.test(title) || BAD.test(ch)) return -1;
  if (!artist) return 10;
  const a = norm(artist);
  const chExact = ch === a || ch === a + " topic" || ch === a + " official" || ch === a + " vevo";
  const chLoose = hasWords(ch, a) && CH_OK.test(ch);
  const m = decode(track.title).split(/\s[-–—|:]\s|\s[-–—|]|[-–—|]\s/);
  const lead = m.length > 1 ? norm(m[0]) : "";
  const leadHit = !!lead && hasWords(lead, a);
  const collab = hasWords(title, a) && COLLAB.test(title);
  // Judul berformat "Artis lain - Lagu" dari kanal bukan milik artis => buang (mis. Tulus di katalog Hindia).
  if (lead && !leadHit && !chExact && !chLoose && !collab) return -1;
  if (!(chExact || chLoose || leadHit || collab)) return -1;
  return (chExact ? 70 : chLoose ? 50 : 0) + (leadHit ? 40 : 0) + (collab ? 15 : 0)
    + (/official/.test(title) ? 5 : 0) + (/topic$/.test(ch) ? 5 : 0);
}

export function dedupeKey(track, artist) {
  let k = norm(String(track.title).replace(/[\(\[][^\)\]]*[\)\]]/g, " "));
  k = k.replace(NOISE, " ");
  for (const w of norm(artist).split(" ")) if (w) k = (" " + k + " ").replace(" " + w + " ", " ");
  return k.replace(/\s+/g, " ").trim();
}

export function rank(items, artist) {
  const best = new Map();
  for (const t of items) {
    if (!t.id) continue;
    const score = scoreItem(t, artist);
    if (score < 0) continue;
    const k = dedupeKey(t, artist) || t.id;
    const cur = best.get(k);
    if (!cur || score > cur.score) best.set(k, { ...t, score });
  }
  return [...best.values()].sort((a, b) => b.score - a.score);
}
