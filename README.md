# 🎬 Undian Nobar

Aplikasi undian untuk acara **nonton bareng**. Penonton scan QR → isi **Nama, No HP, NIK** → dapat **nomor undian** untuk di-screenshot. Panitia menarik pemenang (1, 5, 10, atau berapa pun) lewat panel, dengan mekanisme **adil & dapat diverifikasi (commit-reveal)**.

## Prinsip yang dijamin

1. **Anti-dobel** — 1 NIK hanya bisa mendaftar sekali (unique constraint di database).
2. **NIK sebagai patokan utama** — divalidasi struktur 16 digit (kode wilayah + tanggal lahir).
3. **Nyempang HP** — satu No HP boleh dipakai untuk **maksimal 3** pendaftaran (orang tanpa HP bisa numpang).
4. **Privasi** — NIK & No HP **disensor** di layar publik (`3201********0007`, `0812****7890`). Data lengkap hanya terlihat di panel panitia (terkunci password). Penyimpanan polos + Row Level Security (akses hanya dari server).
5. **Undian adil** — pemenang ditentukan deterministik dari sebuah *seed*; **hash seed ditampilkan sebelum penarikan**, seed dibuka setelahnya, sehingga hasil bisa diaudit dan panitia tidak bisa mengatur pemenang.

## Halaman

| Rute        | Untuk        | Fungsi                                                             |
| ----------- | ------------ | ----------------------------------------------------------------- |
| `/daftar`   | Penonton     | Form pendaftaran → kartu nomor undian untuk di-screenshot         |
| `/checkin`  | Penonton     | Konfirmasi kehadiran di lokasi (NIK + kode dari layar)            |
| `/panitia`  | Panitia      | Login, statistik, buka/tutup check-in, kunci & tarik undian, tabel peserta, QR, hapus data |
| `/layar`    | Proyektor    | Counter Hadir + kode check-in berputar + pengumuman pemenang      |

## Check-in kehadiran (hanya yang hadir yang diundi)

Agar nomor yang tidak hadir tidak ikut diundi, ada langkah **check-in di lokasi**:

1. Panitia menekan **Buka Check-in** di `/panitia`.
2. `/layar` (setelah panitia login di perangkat proyektor) menampilkan **kode 6 digit + QR yang berganti tiap 45 detik**. Kode dihitung dari `DATA_SECRET` + waktu (ala TOTP) dan **hanya bisa dilihat lewat layar** (endpoint kode butuh login panitia) — jadi peserta harus benar-benar hadir.
3. Peserta buka `/checkin`, isi **NIK + kode yang tampil di layar** (atau scan QR-nya) → status jadi **HADIR**.
4. Saat mengundi, **pool hanya berisi peserta yang HADIR**. Yang tidak check-in tidak akan pernah ditarik.

> Catatan: kode bisa "dititipkan" via chat oleh yang di dalam ke yang di luar — diperkecil dengan rotasi cepat (45 dtk) & 1 NIK sekali check-in. Untuk anti-titip mutlak, gabungkan dengan scan tiket di gerbang oleh petugas.

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
| `DATA_SECRET`          | String acak ≥32 karakter (`openssl rand -hex 32`) — hanya untuk menandatangani token login panitia |
| `PANITIA_PASSWORD`     | Password login panel panitia                                     |

> `DATA_SECRET` kini hanya untuk token login panitia — mengubahnya hanya memaksa panitia login ulang, tidak memengaruhi data.
>
> ⚠️ **Wajib diganti dari default.** Jika `DATA_SECRET` (≥16 karakter) atau `PANITIA_PASSWORD` (≥6 karakter) masih bernilai default, panel panitia (`/api/panitia`) menolak jalan dengan pesan 503. Endpoint `/api/register` juga dibatasi **rate limit** (maks 20/menit/IP) dan login panitia (maks 8 percobaan/menit/IP) untuk mencegah spam & brute force.

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

- Data disimpan **polos** (nama, NIK, No HP apa adanya) demi kesederhanaan. Perlindungannya: tabel memakai **Row Level Security** dan hanya diakses serverless function via `service_role` key — anon key dari browser tidak bisa membaca tabel.
- Ke halaman publik/layar hanya dikirim versi **tersensor** NIK & No HP; data lengkap hanya terlihat di panel panitia (butuh password) untuk mencocokkan KTP pemenang.
- Validasi NIK bersifat **struktural** (bukan verifikasi Dukcapil) — menyaring NIK asal-ketik, bukan jaminan identitas.

### Mengisi data uji (opsional)
`scripts/generate-seed.mjs` membuat 2000 data acak valid:
```bash
N=2000 MODE=csv node scripts/generate-seed.mjs   # → seed_participants.csv, impor via Supabase Table Editor
# atau seed lewat API aplikasi yang sudah online:
APP_URL="https://namaapp.vercel.app" N=2000 MODE=api node scripts/generate-seed.mjs
```
