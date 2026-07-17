// api/panitia.js — Panel PANITIA (butuh login password → token sesi).
//
//  POST ?op=auth      { password }          → { ok, token, ttl_ms }   (publik)
//  ── berikut butuh header  Authorization: Bearer <token> ──
//  GET  ?op=session                         → { ok } (cek token masih valid)
//  GET  ?op=stats                           → ringkasan + daftar sesi undian
//  GET  ?op=participants&page=&q=           → daftar peserta (tersensor)
//  GET  ?op=reveal_one&number=              → buka data lengkap 1 peserta
//  GET  ?op=draw_detail&id=                 → detail pemenang (data lengkap)
//  POST ?op=prepare   { n_winners }         → kunci undian (commit)
//  POST ?op=reveal    { id }                → tarik pemenang (reveal)
//  POST ?op=cancel_draw { id }              → batalkan undian yang belum ditarik
//  POST ?op=set_event { event_name }        → ubah nama acara
//  POST ?op=toggle_registration { open }    → buka/tutup pendaftaran
//  POST ?op=purge     { confirm: "HAPUS" }  → hapus SEMUA data (pasca-acara)

import {
  CONFIGURED,
  cors,
  notConfigured,
  requireAuth,
  checkPassword,
  makeToken,
  sha256hex,
  drawWinners,
  pad,
  sbGet,
  sbCount,
  sbInsert,
  sbPatch,
  sbDelete,
  getSettings,
} from "./_lib.js";

import { randomBytes } from "node:crypto";

const AUTH_TTL_MS = 12 * 3600 * 1000;

// Kumpulan nomor pemenang dari seluruh undian yang SUDAH ditarik.
async function previousWinners() {
  const rows = await sbGet("draws?status=eq.revealed&select=winners");
  const set = new Set();
  for (const r of rows || []) for (const n of r.winners || []) set.add(Number(n));
  return set;
}

// Detail lengkap (NIK & HP dibuka) untuk sekumpulan nomor undian.
async function winnersDetail(numbers) {
  if (!numbers.length) return [];
  const rows = await sbGet(
    `participants?raffle_number=in.(${numbers.join(",")})&select=raffle_number,nama,nik,hp`
  );
  const byNum = new Map((rows || []).map((r) => [r.raffle_number, r]));
  return numbers.map((n) => {
    const r = byNum.get(n);
    return {
      nomor: pad(n),
      raffle_number: n,
      nama: r?.nama || "—",
      nik: r?.nik || "—",
      hp: r?.hp || "—",
    };
  });
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (!CONFIGURED) return notConfigured(res);

  const op = String(req.query.op || "");
  const body = req.body || {};

  try {
    // ── Login (publik) ────────────────────────────────────────────────────────
    if (req.method === "POST" && op === "auth") {
      if (!checkPassword(body.password))
        return res.status(401).json({ error: "Password panitia salah." });
      return res.status(200).json({ ok: true, token: makeToken(AUTH_TTL_MS), ttl_ms: AUTH_TTL_MS });
    }

    // ── Semua op lain butuh token valid ──────────────────────────────────────
    if (!requireAuth(req))
      return res.status(401).json({ error: "Sesi tidak valid. Silakan login ulang." });

    // ── GET ──────────────────────────────────────────────────────────────────
    if (req.method === "GET") {
      if (op === "session") return res.status(200).json({ ok: true });

      if (op === "stats") {
        const [settings, total, male, female, draws] = await Promise.all([
          getSettings(),
          sbCount("participants?raffle_number=gte.0"),
          sbCount("participants?gender=eq.L"),
          sbCount("participants?gender=eq.P"),
          sbGet("draws?select=id,prize,seed_hash,n_winners,pool,winners,status,committed_at,revealed_at&order=id.desc"),
        ]);
        const drawList = (draws || []).map((d) => ({
          id: d.id,
          prize: d.prize || null,
          status: d.status,
          seed_hash: d.seed_hash,
          n_winners: d.n_winners,
          pool_size: Array.isArray(d.pool) ? d.pool.length : 0,
          winners: (d.winners || []).map(pad),
          committed_at: d.committed_at,
          revealed_at: d.revealed_at,
        }));
        return res.status(200).json({
          event_name: settings.event_name,
          registration_open: settings.registration_open,
          total,
          gender: { L: male, P: female },
          draws: drawList,
        });
      }

      if (op === "participants") {
        const page = Math.max(1, parseInt(String(req.query.page || "1"), 10) || 1);
        const size = 25;
        const from = (page - 1) * size;
        const to = from + size - 1;
        const q = String(req.query.q || "").trim();

        let filter = "participants?select=raffle_number,nama,nik,hp,gender,created_at";
        if (q) {
          if (/^\d+$/.test(q)) filter += `&raffle_number=eq.${parseInt(q, 10)}`;
          else filter += `&nama=ilike.*${encodeURIComponent(q)}*`;
        }
        filter += "&order=raffle_number.desc";

        const rows = await sbGet(`${filter}&limit=${size}&offset=${from}`);
        const totalMatched = await sbCount(
          q
            ? /^\d+$/.test(q)
              ? `participants?raffle_number=eq.${parseInt(q, 10)}`
              : `participants?nama=ilike.*${encodeURIComponent(q)}*`
            : "participants?raffle_number=gte.0"
        );
        const items = (rows || []).map((r) => ({
          nomor: pad(r.raffle_number),
          raffle_number: r.raffle_number,
          nama: r.nama,
          gender: r.gender,
          nik: r.nik,
          hp: r.hp,
          created_at: r.created_at,
        }));
        return res.status(200).json({ items, page, size, total: totalMatched, hasMore: to + 1 < totalMatched });
      }

      if (op === "reveal_one") {
        const number = parseInt(String(req.query.number || ""), 10);
        if (!number) return res.status(400).json({ error: "Parameter number wajib." });
        const rows = await sbGet(
          `participants?raffle_number=eq.${number}&select=raffle_number,nama,nik,hp,gender,created_at`
        );
        const r = rows?.[0];
        if (!r) return res.status(404).json({ error: "Peserta tidak ditemukan." });
        return res.status(200).json({
          nomor: pad(r.raffle_number),
          nama: r.nama,
          gender: r.gender,
          nik: r.nik,
          hp: r.hp,
          created_at: r.created_at,
        });
      }

      if (op === "draw_detail") {
        const id = parseInt(String(req.query.id || ""), 10);
        const rows = await sbGet(`draws?id=eq.${id}&select=*`);
        const d = rows?.[0];
        if (!d) return res.status(404).json({ error: "Undian tidak ditemukan." });
        const winners = d.status === "revealed" ? await winnersDetail((d.winners || []).map(Number)) : [];
        return res.status(200).json({
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
        });
      }

      return res.status(400).json({ error: `Operasi GET '${op}' tidak dikenal.` });
    }

    // ── POST ─────────────────────────────────────────────────────────────────
    if (req.method === "POST") {
      if (op === "prepare") {
        // Jangan menyiapkan undian baru bila masih ada yang belum ditarik.
        const pending = await sbGet("draws?status=eq.committed&select=id&limit=1");
        if (pending?.length)
          return res.status(409).json({
            error: "Masih ada undian yang sudah dikunci tapi belum ditarik. Tarik atau batalkan dulu.",
          });

        const prev = await previousWinners();
        const all = await sbGet("participants?select=raffle_number&order=raffle_number.asc");
        const pool = (all || []).map((p) => p.raffle_number).filter((n) => !prev.has(n));
        if (!pool.length)
          return res.status(400).json({ error: "Belum ada peserta yang berhak diundi." });

        let n = parseInt(String(body.n_winners), 10);
        if (!Number.isFinite(n) || n < 1) n = 1;
        if (n > pool.length) n = pool.length;

        const prize = String(body.prize || "").trim().slice(0, 80) || null;
        const seed = randomBytes(32).toString("hex");
        const seed_hash = sha256hex(seed);
        const ins = await sbInsert("draws", {
          prize,
          seed_hash,
          seed,
          n_winners: n,
          pool,
          status: "committed",
        });
        if (!ins.ok) throw new Error(JSON.stringify(ins.data));
        const d = Array.isArray(ins.data) ? ins.data[0] : ins.data;
        return res.status(201).json({
          ok: true,
          id: d.id,
          prize,
          seed_hash,
          n_winners: n,
          pool_size: pool.length,
        });
      }

      if (op === "reveal") {
        const id = parseInt(String(body.id), 10);
        const rows = await sbGet(`draws?id=eq.${id}&select=*`);
        const d = rows?.[0];
        if (!d) return res.status(404).json({ error: "Undian tidak ditemukan." });
        if (d.status === "revealed")
          return res.status(409).json({ error: "Undian ini sudah ditarik." });

        const pool = (d.pool || []).map(Number);
        const winners = drawWinners(d.seed, pool, d.n_winners);
        await sbPatch(`draws?id=eq.${id}`, {
          status: "revealed",
          winners,
          revealed_at: new Date().toISOString(),
        });
        const detail = await winnersDetail(winners);
        return res.status(200).json({
          ok: true,
          id,
          prize: d.prize || null,
          seed: d.seed,
          seed_hash: d.seed_hash,
          n_winners: d.n_winners,
          pool_size: pool.length,
          winners: detail,
        });
      }

      if (op === "cancel_draw") {
        const id = parseInt(String(body.id), 10);
        const rows = await sbGet(`draws?id=eq.${id}&select=id,status`);
        const d = rows?.[0];
        if (!d) return res.status(404).json({ error: "Undian tidak ditemukan." });
        if (d.status === "revealed")
          return res.status(409).json({ error: "Undian yang sudah ditarik tidak bisa dibatalkan." });
        await sbDelete(`draws?id=eq.${id}`);
        return res.status(200).json({ ok: true });
      }

      if (op === "set_event") {
        const event_name = String(body.event_name || "").trim().slice(0, 80) || "Nonton Bareng";
        await sbPatch("settings?id=eq.1", { event_name, updated_at: new Date().toISOString() });
        return res.status(200).json({ ok: true, event_name });
      }

      if (op === "toggle_registration") {
        const open = Boolean(body.open);
        await sbPatch("settings?id=eq.1", {
          registration_open: open,
          updated_at: new Date().toISOString(),
        });
        return res.status(200).json({ ok: true, registration_open: open });
      }

      if (op === "purge") {
        if (String(body.confirm) !== "HAPUS")
          return res.status(400).json({ error: 'Ketik "HAPUS" untuk konfirmasi.' });
        await sbDelete("draws?id=gte.0");
        await sbDelete("participants?raffle_number=gte.0");
        return res.status(200).json({ ok: true });
      }

      return res.status(400).json({ error: `Operasi POST '${op}' tidak dikenal.` });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Terjadi kesalahan pada server." });
  }
}
