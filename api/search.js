export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Server belum dikonfigurasi. Tambahkan YOUTUBE_API_KEY di Vercel Environment Variables." });
  }

  const q = String(req.query.q || "").trim().slice(0, 120);
  if (!q) return res.status(400).json({ error: "Query pencarian kosong." });

  const params = new URLSearchParams({
    part: "snippet",
    q: `${q} music`,
    type: "video",
    videoCategoryId: "10",
    maxResults: "12",
    key: apiKey
  });

  try {
    const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
    const data = await response.json();

    if (!response.ok) {
      const message = data?.error?.message || "YouTube API request failed.";
      return res.status(response.status).json({ error: message });
    }

    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
    return res.status(200).json({ items: data.items || [] });
  } catch {
    return res.status(502).json({ error: "Tidak dapat menghubungi layanan katalog musik." });
  }
}
