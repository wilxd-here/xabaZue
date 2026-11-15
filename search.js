export default async function handler(req, res) {
  if (req.method !== "GET") { res.setHeader("Allow", "GET"); return res.status(405).json({ error: "Method not allowed" }); }
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return res.status(500).json({ error: "YOUTUBE_API_KEY belum diatur di Vercel Environment Variables." });
  const q = String(req.query.q || "").trim().slice(0, 120);
  const artist = String(req.query.artist || "").trim().slice(0, 80);
  if (!q) return res.status(400).json({ error: "Parameter q wajib diisi." });
  try {
    const params = new URLSearchParams({part:"snippet",q,type:"video",maxResults:"25",regionCode:"ID",relevanceLanguage:"id",videoEmbeddable:"true",order:"relevance",key});
    const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: data?.error?.message || "YouTube Data API request failed." });
    let items = data.items || [];
    if (artist) {
      const norm = s => String(s || "").toLocaleLowerCase("id").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
      const target = norm(artist);
      const banned = /\b(cover|karaoke|reaction|react|tutorial|instrumental|nightcore|slowed|speed up|parody)\b/i;
      items = items.filter(item => {
        const title = item.snippet?.title || "";
        const channel = item.snippet?.channelTitle || "";
        if (banned.test(title) || banned.test(channel)) return false;
        const nt = norm(title), nc = norm(channel);
        return nc.includes(target) || nt === target || nt.startsWith(target + " ") || nt.startsWith(target + " -") || nt.startsWith(target + " |") || nt.startsWith(target + ":");
      }).slice(0, 15);
    }
    return res.status(200).json({ items, artist: artist || null });
  } catch (error) { return res.status(502).json({ error: "Gagal menghubungi YouTube Data API." }); }
}
