import { simplify, rank } from "./_lib/relevance.js";

const cache = new Map(); // cache in-memory per instance serverless (TTL 10 menit)
const TTL = 10 * 60 * 1000;
const QUOTA_REASONS = new Set(["quotaExceeded", "dailyLimitExceeded", "rateLimitExceeded", "userRateLimitExceeded"]);
const clean = (v, n) => String(v ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, n);

async function yt(params, key) {
  const u = new URL("https://www.googleapis.com/youtube/v3/search");
  u.search = new URLSearchParams({ ...params, key }).toString();
  const r = await fetch(u, { signal: AbortSignal.timeout(8000) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    const reason = d?.error?.errors?.[0]?.reason || "";
    const err = new Error(reason); err.status = r.status; err.reason = reason; throw err;
  }
  return d;
}

export default async function handler(req, res) {
  if (req.method !== "GET") { res.setHeader("Allow", "GET"); return res.status(405).json({ error: "Method not allowed" }); }
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return res.status(500).json({ error: "Katalog belum dikonfigurasi di server.", code: "NO_KEY" });

  const artist = clean(req.query.artist, 60);
  const q = clean(req.query.q, 100);
  const pageToken = clean(req.query.pageToken, 120);
  if (!q && !artist) return res.status(400).json({ error: "Parameter q atau artist wajib diisi.", code: "BAD_INPUT" });
  if (pageToken && !/^[A-Za-z0-9_-]{1,120}$/.test(pageToken)) return res.status(400).json({ error: "pageToken tidak valid.", code: "BAD_INPUT" });

  const ck = JSON.stringify([artist, q, pageToken]);
  const hit = cache.get(ck);
  if (hit && Date.now() - hit.t < TTL) { res.setHeader("X-Cache", "HIT"); res.setHeader("Cache-Control", "s-maxage=600, stale-while-revalidate=3600"); return res.status(200).json(hit.v); }

  try {
    const query = [artist, q].filter(Boolean).join(" ");
    let token = pageToken, collected = [], next = null;
    // Filtering membuang banyak hasil, jadi ambil maksimal 2 halaman YouTube per request.
    for (let i = 0; i < 2; i++) {
      const d = await yt({ part: "snippet", type: "video", videoCategoryId: "10", videoEmbeddable: "true",
        maxResults: "50", regionCode: "ID", q: query, ...(token ? { pageToken: token } : {}) }, key);
      collected.push(...(d.items || []).map(simplify));
      next = d.nextPageToken || null; token = next;
      if (!next || rank(collected, artist).length >= 12) break;
    }
    const value = { items: rank(collected, artist).slice(0, 30), artist: artist || null, nextPageToken: next };
    cache.set(ck, { t: Date.now(), v: value });
    if (cache.size > 200) cache.delete(cache.keys().next().value);
    res.setHeader("Cache-Control", "s-maxage=600, stale-while-revalidate=3600");
    return res.status(200).json(value);
  } catch (e) {
    if (e.name === "TimeoutError") return res.status(504).json({ error: "YouTube Data API tidak merespons.", code: "TIMEOUT" });
    if (QUOTA_REASONS.has(e.reason)) return res.status(429).json({ error: "Kuota harian katalog habis. Coba lagi nanti.", code: "QUOTA" });
    if (e.status) { console.error("YouTube API:", e.status, e.reason); return res.status(502).json({ error: "Katalog sedang bermasalah.", code: "UPSTREAM" }); }
    return res.status(502).json({ error: "Gagal menghubungi YouTube Data API.", code: "NETWORK" });
  }
}
