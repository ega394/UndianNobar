// api/_lib.js — utilitas bersama untuk seluruh serverless function.
// (Nama diawali underscore → tidak diperlakukan sebagai route oleh Vercel.)

import { createHash, createHmac, timingSafeEqual } from "node:crypto";

// ── Konfigurasi dari environment ────────────────────────────────────────────
const SUPA_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const SUPA_KEY =
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  "";
const DEFAULT_SECRET = "dev-insecure-secret-change-me-please-32b";
const DEFAULT_PASSWORD = "panitia123";
const DATA_SECRET = process.env.DATA_SECRET || DEFAULT_SECRET;
const PANITIA_PASSWORD = process.env.PANITIA_PASSWORD || DEFAULT_PASSWORD;

export const CONFIGURED = Boolean(SUPA_URL && SUPA_KEY);

// Konfigurasi aman? (kredensial sudah diganti dari default & cukup panjang)
export const SECURE_CONFIG =
  DATA_SECRET !== DEFAULT_SECRET &&
  DATA_SECRET.length >= 16 &&
  PANITIA_PASSWORD !== DEFAULT_PASSWORD &&
  PANITIA_PASSWORD.length >= 6;

// Kunci untuk menandatangani token sesi login panitia (bukan untuk data).
const MAC_KEY = "undian-mac:" + DATA_SECRET;

export function sha256hex(s) {
  return createHash("sha256").update(String(s)).digest("hex");
}
export function hmac(s) {
  return createHmac("sha256", MAC_KEY).update(String(s)).digest("hex");
}

// ── Klien Supabase (REST / PostgREST) ───────────────────────────────────────
const H = (extra = {}) => ({
  "Content-Type": "application/json",
  apikey: SUPA_KEY,
  Authorization: `Bearer ${SUPA_KEY}`,
  ...extra,
});

export async function sbGet(path) {
  const r = await fetch(`${SUPA_URL}/rest/v1/${path}`, { headers: H() });
  if (!r.ok) throw new Error(`Supabase GET ${path}: ${await r.text()}`);
  return r.json();
}

// Fetch mentah yang mengembalikan status (untuk mendeteksi konflik unique 409).
export async function sbFetch(path, init = {}) {
  const r = await fetch(`${SUPA_URL}/rest/v1/${path}`, {
    ...init,
    headers: H(init.headers || {}),
  });
  const text = await r.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { ok: r.ok, status: r.status, data, contentRange: r.headers.get("content-range") };
}

export async function sbInsert(table, body, { returning = true } = {}) {
  return sbFetch(table, {
    method: "POST",
    headers: { Prefer: returning ? "return=representation" : "return=minimal" },
    body: JSON.stringify(body),
  });
}

export async function sbPatch(path, body) {
  const r = await sbFetch(path, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`Supabase PATCH ${path}: ${JSON.stringify(r.data)}`);
  return r.data;
}

export async function sbDelete(path) {
  const r = await sbFetch(path, { method: "DELETE", headers: { Prefer: "return=minimal" } });
  if (!r.ok) throw new Error(`Supabase DELETE ${path}: ${JSON.stringify(r.data)}`);
  return true;
}

// Hitung jumlah baris tanpa menarik seluruh data (pakai header Content-Range).
export async function sbCount(pathWithFilter) {
  const r = await sbFetch(`${pathWithFilter}&select=raffle_number`, {
    method: "GET",
    headers: { Prefer: "count=exact", Range: "0-0" },
  });
  const cr = r.contentRange || "";
  const total = parseInt(cr.split("/")[1] || "0", 10);
  return Number.isFinite(total) ? total : 0;
}

// ── Validasi NIK (16 digit, struktur wilayah + tanggal lahir) ───────────────
// Catatan: tanpa koneksi Dukcapil ini hanya memeriksa STRUKTUR, bukan bukti
// kepemilikan. Cukup kuat untuk menyaring NIK asal-ketik.
export function validateNIK(nikRaw) {
  const nik = String(nikRaw || "").replace(/\D/g, "");
  if (nik.length !== 16) return { ok: false, reason: "NIK harus 16 digit angka." };

  const prov = parseInt(nik.slice(0, 2), 10);
  if (!(prov >= 11 && prov <= 94))
    return { ok: false, reason: "Kode provinsi pada NIK tidak valid." };

  let dd = parseInt(nik.slice(6, 8), 10);
  const mm = parseInt(nik.slice(8, 10), 10);
  const female = dd > 40;
  if (female) dd -= 40;
  if (!(dd >= 1 && dd <= 31)) return { ok: false, reason: "Tanggal lahir pada NIK tidak valid." };
  if (!(mm >= 1 && mm <= 12)) return { ok: false, reason: "Bulan lahir pada NIK tidak valid." };

  const seq = parseInt(nik.slice(12, 16), 10);
  if (seq === 0) return { ok: false, reason: "Nomor urut pada NIK tidak valid." };

  return { ok: true, nik, gender: female ? "P" : "L" };
}

// ── Normalisasi & validasi No HP Indonesia ──────────────────────────────────
export function normPhone(hpRaw) {
  let s = String(hpRaw || "").replace(/\D/g, "");
  if (s.startsWith("62")) s = "0" + s.slice(2);
  else if (s.startsWith("8")) s = "0" + s;
  return s;
}
export function validatePhone(hpRaw) {
  const hp = normPhone(hpRaw);
  if (!/^08\d{7,12}$/.test(hp))
    return { ok: false, reason: "No HP tidak valid. Gunakan format 08xxxxxxxxxx." };
  return { ok: true, hp };
}

// ── Sensor untuk tampilan publik ────────────────────────────────────────────
export function censorNIK(nik) {
  const s = String(nik || "");
  if (s.length < 16) return "****";
  return s.slice(0, 4) + "*".repeat(8) + s.slice(12);
}
export function censorHP(hpRaw) {
  const hp = normPhone(hpRaw);
  if (hp.length < 7) return "****";
  return hp.slice(0, 4) + "****" + hp.slice(-4);
}

// ── Format nomor undian → 4 digit (0001) ────────────────────────────────────
export function pad(n) {
  return String(n).padStart(4, "0");
}

// ── Logika undian yang bisa DIVERIFIKASI ─────────────────────────────────────
// winners = N nomor dengan skor SHA-256(`${seed}:${nomor4digit}`) terkecil.
// Bersifat deterministik: siapa pun yang tahu seed + daftar pool bisa hitung
// ulang dan membuktikan panitia tidak mengatur pemenang.
export function drawWinners(seed, pool, count) {
  const scored = pool.map((n) => ({ n: Number(n), s: sha256hex(`${seed}:${pad(n)}`) }));
  scored.sort((a, b) => (a.s < b.s ? -1 : a.s > b.s ? 1 : a.n - b.n));
  return scored.slice(0, Math.max(0, count)).map((x) => x.n);
}

// ── Token sesi panitia (stateless, ditandatangani HMAC) ─────────────────────
export function makeToken(ttlMs = 12 * 3600 * 1000) {
  const exp = Date.now() + ttlMs;
  const payload = `panitia.${exp}`;
  const sig = hmac(payload);
  return Buffer.from(`${payload}.${sig}`).toString("base64url");
}
export function verifyToken(token) {
  try {
    const raw = Buffer.from(String(token || ""), "base64url").toString("utf8");
    const i = raw.lastIndexOf(".");
    if (i < 0) return false;
    const payload = raw.slice(0, i);
    const sig = raw.slice(i + 1);
    const expSig = hmac(payload);
    if (sig.length !== expSig.length) return false;
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expSig))) return false;
    const exp = parseInt(payload.split(".")[1], 10);
    return Date.now() < exp;
  } catch {
    return false;
  }
}
export function checkPassword(pw) {
  const a = Buffer.from(String(pw || ""));
  const b = Buffer.from(PANITIA_PASSWORD);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
export function requireAuth(req) {
  const auth = req.headers["authorization"] || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : req.headers["x-panitia-token"] || "";
  return verifyToken(token);
}

// ── Helper HTTP ─────────────────────────────────────────────────────────────
export function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Panitia-Token");
}
export function notConfigured(res) {
  return res.status(503).json({
    error:
      "Server belum dikonfigurasi. Set SUPABASE_URL, SUPABASE_SERVICE_KEY, DATA_SECRET, dan PANITIA_PASSWORD di environment.",
  });
}
export function insecureConfig(res) {
  return res.status(503).json({
    error:
      "Konfigurasi tidak aman: setel DATA_SECRET (≥16 karakter acak) dan PANITIA_PASSWORD (≥6 karakter) yang bukan nilai default di environment Vercel, lalu redeploy.",
  });
}

// ── Rate limiter sederhana (in-memory per instance) ─────────────────────────
const RL = new Map();
export function getIP(req) {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.headers["x-real-ip"] ||
    req.socket?.remoteAddress ||
    "unknown"
  );
}
export function rateLimit(key, max, windowMs) {
  const now = Date.now();
  const e = RL.get(key) || { count: 0, resetAt: now + windowMs };
  if (now > e.resetAt) {
    e.count = 0;
    e.resetAt = now + windowMs;
  }
  e.count++;
  RL.set(key, e);
  if (RL.size > 5000) for (const [k, v] of RL) if (now > v.resetAt) RL.delete(k);
  return e.count <= max;
}

// Ambil SELURUH raffle_number peserta dgn keyset pagination (lewati batas
// default PostgREST yang bisa memotong hasil di ~1000 baris).
export async function allRaffleNumbers() {
  const out = [];
  const PAGE = 1000;
  let last = -1;
  // Loop sampai halaman kosong — aman walau server membatasi baris per request.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const rows = await sbGet(
      `participants?select=raffle_number&raffle_number=gt.${last}&order=raffle_number.asc&limit=${PAGE}`
    );
    if (!rows.length) break;
    for (const r of rows) out.push(r.raffle_number);
    last = rows[rows.length - 1].raffle_number;
  }
  return out;
}
export function getSettings() {
  return sbGet("settings?id=eq.1&select=event_name,registration_open").then((r) => r?.[0] || {
    event_name: "Nonton Bareng",
    registration_open: true,
  });
}
