// api/register.js — Pendaftaran peserta undian (publik, dari hasil scan QR).
//
// POST /api/register  { nama, hp, nik }
//   → validasi NIK & HP, cek anti-dobel (NIK unik) + batas 3 pendaftaran/HP,
//     terbitkan nomor undian otomatis.
//   → { ok, raffle_number, nomor, nama, nik_masked, hp_masked, event_name }
//   → jika NIK sudah terdaftar: { ok, duplicate: true, ... } (kembalikan nomornya)

import {
  CONFIGURED,
  cors,
  notConfigured,
  validateNIK,
  validatePhone,
  censorNIK,
  censorHP,
  pad,
  sbCount,
  sbGet,
  sbInsert,
  getSettings,
} from "./_lib.js";

const MAX_PER_PHONE = 3;

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!CONFIGURED) return notConfigured(res);

  try {
    const body = req.body || {};
    const nama = String(body.nama || "").trim().replace(/\s+/g, " ");

    // ── Validasi input ──────────────────────────────────────────────────────
    if (nama.length < 2 || nama.length > 60)
      return res.status(400).json({ error: "Nama wajib diisi (2–60 karakter)." });

    const nikCheck = validateNIK(body.nik);
    if (!nikCheck.ok) return res.status(400).json({ error: nikCheck.reason });

    const hpCheck = validatePhone(body.hp);
    if (!hpCheck.ok) return res.status(400).json({ error: hpCheck.reason });

    // ── Pendaftaran ditutup? ─────────────────────────────────────────────────
    const settings = await getSettings();
    if (!settings.registration_open)
      return res.status(403).json({ error: "Pendaftaran sudah ditutup oleh panitia." });

    const nik = nikCheck.nik;
    const hp = hpCheck.hp;

    // ── Anti-dobel: NIK sudah terdaftar? kembalikan nomor yang sudah ada ──────
    const existing = await sbGet(`participants?nik=eq.${nik}&select=raffle_number,nama`);
    if (existing?.length) {
      const p = existing[0];
      return res.status(200).json({
        ok: true,
        duplicate: true,
        raffle_number: p.raffle_number,
        nomor: pad(p.raffle_number),
        nama: p.nama,
        nik_masked: censorNIK(nik),
        hp_masked: censorHP(hp),
        event_name: settings.event_name,
        message: "NIK ini sudah terdaftar. Ini nomor undian Anda.",
      });
    }

    // ── Batas maksimal 3 pendaftaran per nomor HP ────────────────────────────
    const phoneCount = await sbCount(`participants?hp=eq.${hp}`);
    if (phoneCount >= MAX_PER_PHONE)
      return res.status(409).json({
        error: `No HP ini sudah dipakai untuk ${MAX_PER_PHONE} pendaftaran (batas maksimal). Gunakan No HP lain.`,
      });

    // ── Simpan ────────────────────────────────────────────────────────────────
    const ins = await sbInsert("participants", { nama, nik, hp, gender: nikCheck.gender });

    // Tangani balapan (dua request NIK sama nyaris bersamaan) → 409 unique.
    if (!ins.ok) {
      if (ins.status === 409) {
        const again = await sbGet(`participants?nik=eq.${nik}&select=raffle_number,nama`);
        if (again?.length) {
          const p = again[0];
          return res.status(200).json({
            ok: true,
            duplicate: true,
            raffle_number: p.raffle_number,
            nomor: pad(p.raffle_number),
            nama: p.nama,
            nik_masked: censorNIK(nik),
            hp_masked: censorHP(hp),
            event_name: settings.event_name,
            message: "NIK ini sudah terdaftar. Ini nomor undian Anda.",
          });
        }
      }
      throw new Error(typeof ins.data === "string" ? ins.data : JSON.stringify(ins.data));
    }

    const row = Array.isArray(ins.data) ? ins.data[0] : ins.data;
    return res.status(201).json({
      ok: true,
      duplicate: false,
      raffle_number: row.raffle_number,
      nomor: pad(row.raffle_number),
      nama: row.nama,
      nik_masked: censorNIK(nik),
      hp_masked: censorHP(hp),
      event_name: settings.event_name,
    });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Terjadi kesalahan pada server." });
  }
}
