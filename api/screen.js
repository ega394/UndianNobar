// api/screen.js — Data untuk LAYAR PUBLIK (proyektor). Tanpa autentikasi.
// Semua data sensitif (NIK, No HP) TIDAK ikut dikirim ke sini.
//
// GET /api/screen
//   → { event_name, registration_open, total, recent[], draw }
//     recent : pendaftar terbaru (nomor + nama) untuk feed langsung
//     draw   : sesi undian terbaru — saat 'committed' hanya seed_hash yang
//              tampil (komitmen), saat 'revealed' seed + pemenang dibuka.

import {
  CONFIGURED,
  cors,
  notConfigured,
  pad,
  censorNIK,
  censorHP,
  sbGet,
  sbCount,
  getSettings,
} from "./_lib.js";

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  if (!CONFIGURED) return notConfigured(res);

  try {
    const [settings, total, hadir, drawRows] = await Promise.all([
      getSettings(),
      sbCount("participants?raffle_number=gte.0"),
      sbCount("participants?hadir=is.true"),
      sbGet("draws?select=*&order=id.desc&limit=1"),
    ]);

    let draw = null;
    const d = drawRows?.[0];
    if (d) {
      const winnersRaw = Array.isArray(d.winners) ? d.winners : [];
      let winners = [];
      if (d.status === "revealed" && winnersRaw.length) {
        // Ambil nama + NIK/HP pemenang; NIK & HP DISENSOR sebelum ke layar publik.
        const list = winnersRaw.join(",");
        const rows = await sbGet(
          `participants?raffle_number=in.(${list})&select=raffle_number,nama,nik,hp`
        );
        const byNum = new Map((rows || []).map((r) => [r.raffle_number, r]));
        winners = winnersRaw.map((n) => {
          const r = byNum.get(n);
          return {
            nomor: pad(n),
            nama: r?.nama || "—",
            nik_masked: r ? censorNIK(r.nik) : "—",
            hp_masked: r ? censorHP(r.hp) : "—",
          };
        });
      }
      draw = {
        id: d.id,
        prize: d.prize || null,
        status: d.status,
        seed_hash: d.seed_hash,
        seed: d.status === "revealed" ? d.seed : null,
        n_winners: d.n_winners,
        pool_size: Array.isArray(d.pool) ? d.pool.length : 0,
        committed_at: d.committed_at,
        revealed_at: d.revealed_at,
        winners,
      };
    }

    return res.status(200).json({
      event_name: settings.event_name,
      registration_open: settings.registration_open,
      checkin_open: settings.checkin_open,
      total,
      hadir,
      draw,
    });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Terjadi kesalahan pada server." });
  }
}
