import test from "node:test"; import assert from "node:assert/strict";
import handler from "../api/search.js";
const mk = q => ({ method: "GET", query: q });
const res = () => { const r = { h: {}, setHeader(k, v) { r.h[k] = v }, status(c) { r.c = c; return r }, json(b) { r.b = b; return r } }; return r };
const yt = items => ({ ok: true, json: async () => ({ items: items.map(([id, title, ch]) => ({ id: { videoId: id }, snippet: { title, channelTitle: ch, thumbnails: {} } })), nextPageToken: "abc_1" }) });
test("tanpa API key -> 500 tanpa membocorkan detail", async () => { delete process.env.YOUTUBE_API_KEY; const r = res(); await handler(mk({ q: "x" }), r); assert.equal(r.c, 500); assert.equal(r.b.code, "NO_KEY") });
test("input tidak valid -> 400", async () => { process.env.YOUTUBE_API_KEY = "k"; let r = res(); await handler(mk({}), r); assert.equal(r.c, 400); r = res(); await handler(mk({ q: "a", pageToken: "../x" }), r); assert.equal(r.c, 400) });
test("quota -> 429", async () => { globalThis.fetch = async () => ({ ok: false, status: 403, json: async () => ({ error: { errors: [{ reason: "quotaExceeded" }] } }) }); const r = res(); await handler(mk({ artist: "Quota" }), r); assert.equal(r.c, 429); assert.equal(r.b.code, "QUOTA") });
test("hasil Hindia terfilter + pageToken diteruskan", async () => { globalThis.fetch = async () => yt([["1", "Hindia - Secukupnya", "Hindia"], ["2", "Tulus - Monokrom", "Tulus"], ["3", "Mix Lagu Galau", "Playlist"]]); const r = res(); await handler(mk({ artist: "Hindia", q: "" }), r); assert.equal(r.c, 200); assert.deepEqual(r.b.items.map(i => i.id), ["1"]); assert.equal(r.b.nextPageToken, "abc_1") });
