# 🎬 Undian Nobar

Aplikasi undian untuk acara **nonton bareng**. Penonton scan QR → isi **Nama, No HP, NIK** → dapat **nomor undian** untuk di-screenshot. Panitia menarik pemenang (1, 5, 10, atau berapa pun) lewat panel, dengan mekanisme **adil & dapat diverifikasi (commit-reveal)**.

## Prinsip yang dijamin

1. **Anti-dobel** — 1 NIK hanya bisa mendaftar sekali (unique constraint di database).
2. **NIK sebagai patokan utama** — divalidasi struktur 16 digit (kode wilayah + tanggal lahir).
3. **Nyempang HP** — satu No HP boleh dipakai untuk **maksimal 3** pendaftaran (orang tanpa HP bisa numpang).
4. **Privasi** — NIK & No HP disimpan **terenkripsi** (AES-256-GCM) dan **disensor** di layar publik (`3201********0007`, `0812****7890`).
5. **Undian adil** — pemenang ditentukan deterministik dari sebuah *seed*; **hash seed ditampilkan sebelum penarikan**, seed dibuka setelahnya, sehingga hasil bisa diaudit dan panitia tidak bisa mengatur pemenang.

## Halaman

| Rute        | Untuk        | Fungsi                                                             |
| ----------- | ------------ | ----------------------------------------------------------------- |
| `/daftar`   | Penonton     | Form pendaftaran → kartu nomor undian untuk di-screenshot         |
| `/panitia`  | Panitia      | Login, statistik, kunci & tarik undian, tabel peserta, QR, hapus data |
| `/layar`    | Proyektor    | Counter pendaftar langsung + pengumuman pemenang (data tersensor) |

## Tech stack

- **Frontend:** Vite + React + TypeScript + Tailwind CSS
- **Backend:** Vercel Serverless Functions (`/api`)
- **Database:** Supabase (PostgreSQL) — diakses hanya dari server via service_role key
- **Deploy:** Vercel

## Cara setup

### 1. Database (Supabase)

1. Buat project di [supabase.com](https://supabase.com).
2. Buka **SQL Editor** → tempel seluruh isi [`supabase/schema.sql`](supabase/schema.sql) → **Run**.
3. Catat dari **Project Settings → API**: `Project URL` dan **`service_role`** key.

### 2. Environment variables

Salin `.env.example` → `.env` (untuk lokal) atau isi di **Vercel → Settings → Environment Variables**:

| Variabel               | Keterangan                                                        |
| ---------------------- | ----------------------------------------------------------------- |
| `SUPABASE_URL`         | Project URL Supabase                                              |
| `SUPABASE_SERVICE_KEY` | **service_role** key (rahasia, hanya dipakai serverless function) |
| `DATA_SECRET`          | String acak ≥32 karakter (`openssl rand -hex 32`) — kunci enkripsi & hashing |
| `PANITIA_PASSWORD`     | Password login panel panitia                                     |

> ⚠️ `DATA_SECRET` dipakai untuk enkripsi NIK/HP **dan** untuk hashing anti-dobel. Jangan pernah mengubahnya setelah ada data masuk, dan jangan bocorkan.

### 3. Jalankan

```bash
npm install

# Pengembangan penuh (frontend + serverless function) butuh Vercel CLI:
npm i -g vercel
vercel dev        # menyervis /api + frontend di http://localhost:3000

# atau frontend saja (tanpa API):
npm run dev
```

### 4. Deploy

Hubungkan repo ke Vercel, set environment variables di atas, deploy. `vercel.json` sudah mengatur rewrite SPA + `/api`.

## Alur hari-H

1. Panitia buka `/panitia` → set **Nama Acara** → pastikan **Pendaftaran Dibuka**.
2. Buat **QR** (menu QR Pendaftaran) → cetak & pasang. QR menuju `/daftar`.
3. Buka `/layar` di proyektor.
4. Penonton scan → daftar → screenshot nomor.
5. Saat undian: panitia pilih jumlah pemenang → **🔒 Kunci Undian** (hash muncul di layar) → **🎉 Tarik Pemenang**. Pemenang tampil di layar; data lengkap (untuk cocok KTP) tampil di panel panitia.
6. Selesai acara: **Hapus Semua Data**.

## Cara memverifikasi keadilan undian

Setiap sesi undian menyimpan `seed` dan `pool` (daftar nomor peserta yang berhak). Rumusnya:

```
skor(nomor) = SHA-256( "<seed>:<nomor 4 digit>" )
pemenang    = N nomor dengan skor terkecil (urut menaik)
```

Karena **hash dari seed** (`seed_hash = SHA-256(seed)`) dipublikasikan **sebelum** seed dibuka, panitia tidak mungkin memilih seed agar orang tertentu menang. Setelah penarikan, siapa pun bisa mengambil `seed` + daftar `pool` dan menghitung ulang untuk membuktikan hasilnya benar.

Contoh verifikasi (Node.js):

```js
import { createHash } from "node:crypto";
const sha = (s) => createHash("sha256").update(s).digest("hex");
const pad = (n) => String(n).padStart(4, "0");

// seed & pool diambil dari data undian
const winners = pool
  .map((n) => ({ n, s: sha(`${seed}:${pad(n)}`) }))
  .sort((a, b) => (a.s < b.s ? -1 : 1))
  .slice(0, nWinners)
  .map((x) => pad(x.n));
```

## Catatan keamanan & privasi

- NIK & No HP **tidak pernah** dikirim ke halaman publik/layar; hanya versi tersensor.
- Data lengkap hanya bisa dibuka di panel panitia (butuh password) dan dipakai untuk mencocokkan KTP pemenang.
- Validasi NIK bersifat **struktural** (bukan verifikasi Dukcapil) — menyaring NIK asal-ketik, bukan jaminan identitas.
- Seluruh tabel memakai **Row Level Security**; akses data hanya lewat serverless function dengan service key.
