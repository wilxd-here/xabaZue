import test from "node:test"; import assert from "node:assert/strict";
import { rank, norm, scoreItem } from "../api/_lib/relevance.js";
const T = (title, channel, id = title) => ({ id, title, channel });
const pool = [
  T("Hindia - Everything u are", "Hindia"), T("Hindia - Everything u are (Official Video)", "Hindia", "dup"),
  T("Tulus - Monokrom", "Tulus"), T("Tulus - Hindia cover", "Fan"),
  T("Cara Mengakhiri Cinta", "Hindia - Topic"), T("Hindia - Evaluasi (karaoke)", "Karaoke ID"),
  T("Lagu Galau Terbaik 2024", "Playlist Indo"), T("Lamunan feat. Hindia", "Rapper X"),
  T("Mantan Terindah - Hindia", "Random Lyrics"), T("Tulus - Hindia Tribute", "Tulus"),
];
test("katalog Hindia tidak berisi lagu Tulus/acak", () => {
  const r = rank(pool, "Hindia");
  const titles = r.map(x => x.title);
  assert.ok(titles.includes("Hindia - Everything u are") || titles.includes("Hindia - Everything u are (Official Video)"));
  assert.ok(!titles.some(t => /^Tulus - Monokrom/.test(t)));
  assert.ok(!titles.includes("Lagu Galau Terbaik 2024"));
  assert.ok(!titles.some(t => /karaoke|cover/i.test(t)));
  assert.ok(titles.includes("Lamunan feat. Hindia"), "kolaborasi relevan dipertahankan");
});
test("dedup versi video yang sama", () => {
  const r = rank(pool, "Hindia").filter(x => /Everything u are/.test(x.title));
  assert.equal(r.length, 1);
});
test("katalog Tulus hanya Tulus", () => {
  const r = rank([T("Tulus - Monokrom", "Tulus"), T("Hindia - Evaluasi", "Hindia")], "Tulus");
  assert.deepEqual(r.map(x => x.title), ["Tulus - Monokrom"]);
});
test("normalisasi", () => assert.equal(norm("Sheila On 7!"), "sheila on 7"));
test("tanpa artis: hanya buang noise", () => assert.equal(scoreItem(T("x - y", "z"), ""), 10));
