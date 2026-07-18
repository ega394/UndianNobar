// api/checkin.js — Check-in kehadiran di lokasi.
//
//  GET  ?op=code           (butuh token panitia) → kode berputar utk ditampilkan di LAYAR
//  POST { nik, code }      (publik)              → tandai peserta HADIR
//
// Hanya peserta yang HADIR yang masuk pool undian. Kode hanya tampil di layar
// venue (endpoint kode butuh login panitia) sehingga harus berada di lokasi.

import {
  CONFIGURED,
  cors,
  notConfigured,
  requireAuth,
  rateLimit,
  getIP,
  validateNIK,
  currentCheckin,
  verifyCheckinCode,
  pad,
  sbGet,
  sbPatch,
  getSettings,
} from "./_lib.js";

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (!CONFIGURED) return notConfigured(res);

  try {
    // ── Kode berputar untuk LAYAR (butuh login panitia) ──────────────────────
    if (req.method === "GET" && req.query.op === "code") {
      if (!requireAuth(req))
        return res.status(401).json({ error: "Sesi tidak valid. Login panitia untuk menampilkan kode." });
      const settings = await getSettings();
      const c = currentCheckin();
      return res.status(200).json({
        code: c.code,
        period: c.period,
        seconds_remaining: c.secondsRemaining,
        checkin_open: settings.checkin_open,
      });
    }

    // ── Check-in oleh peserta (publik) ───────────────────────────────────────
    if (req.method === "POST") {
      if (!rateLimit("checkin:" + getIP(req), 30, 60_000))
        return res.status(429).json({ error: "Terlalu banyak permintaan. Coba lagi sebentar." });

      const body = req.body || {};
      const nikCheck = validateNIK(body.nik);
      if (!nikCheck.ok) return res.status(400).json({ error: nikCheck.reason });

      const settings = await getSettings();
      if (!settings.checkin_open)
        return res.status(403).json({ error: "Check-in belum dibuka / sudah ditutup oleh panitia." });

      if (!verifyCheckinCode(body.code))
        return res.status(400).json({
          error: "Kode check-in salah atau sudah berganti. Lihat kode terbaru di layar lalu coba lagi.",
        });

      const rows = await sbGet(
        `participants?nik=eq.${nikCheck.nik}&select=raffle_number,nama,hadir`
      );
      const p = rows?.[0];
      if (!p)
        return res.status(404).json({ error: "NIK belum terdaftar. Silakan daftar dulu." });

      if (p.hadir)
        return res.status(200).json({
          ok: true,
          already: true,
          nomor: pad(p.raffle_number),
          nama: p.nama,
          message: "Anda sudah check-in sebelumnya.",
        });

      await sbPatch(`participants?nik=eq.${nikCheck.nik}`, {
        hadir: true,
        checked_in_at: new Date().toISOString(),
      });
      return res.status(200).json({
        ok: true,
        already: false,
        nomor: pad(p.raffle_number),
        nama: p.nama,
      });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Terjadi kesalahan pada server." });
  }
}
