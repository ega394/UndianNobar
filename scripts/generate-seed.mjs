// scripts/generate-seed.mjs
// Generator data uji untuk aplikasi Undian Nobar.
//
// Menghasilkan N peserta acak (nama, No HP, NIK) yang VALID sesuai validasi
// aplikasi, lalu:
//   • MODE=csv  → tulis `seed_participants.csv` (siap diimpor ke tabel Supabase,
//                 kolom sudah di-hash & dienkripsi memakai DATA_SECRET) +
//                 `seed_plain.csv` (referensi NIK/HP asli untuk pengetesan).
//   • MODE=api  → kirim langsung ke endpoint /api/register aplikasi yang sudah
//                 online (menguji seluruh alur, tanpa perlu tahu DATA_SECRET).
//
// Cara pakai:
//   # Impor lewat Supabase (butuh DATA_SECRET yang SAMA dengan yang di Vercel):
//   DATA_SECRET="<secret-anda>" N=2000 MODE=csv node scripts/generate-seed.mjs
//
//   # Atau seed lewat API aplikasi yang sudah dideploy:
//   APP_URL="https://namaapp.vercel.app" N=2000 MODE=api node scripts/generate-seed.mjs
//
// Reuse fungsi hash/enkripsi/validasi dari aplikasi → dijamin kompatibel.
import { encrypt, hmac, validateNIK, validatePhone } from "../api/_lib.js";
import { writeFileSync } from "node:fs";

const N = parseInt(process.env.N || process.argv[2] || "2000", 10);
const MODE = (process.env.MODE || "csv").toLowerCase();

// ── Kumpulan nama Indonesia ──────────────────────────────────────────────────
const MALE = ["Budi","Agus","Andi","Bayu","Dedi","Eko","Fajar","Gunawan","Hadi","Iwan","Joko","Rizky","Rudi","Slamet","Teguh","Wahyu","Yusuf","Bagus","Candra","Dimas","Ferry","Galih","Hendra","Irfan","Krisna","Adi","Rahmat","Surya","Bambang","Reza","Aditya","Firman","Panji","Wisnu","Arif"];
const FEMALE = ["Siti","Dewi","Rina","Ayu","Putri","Wati","Sri","Lina","Maya","Nur","Indah","Fitri","Ratna","Yuni","Anisa","Citra","Diana","Endah","Gita","Hesti","Intan","Kartika","Lestari","Mega","Nadia","Sari","Wulan","Zahra","Melati","Tari","Vina","Rani","Salsa"];
const LAST = ["Santoso","Wijaya","Saputra","Nugroho","Hidayat","Setiawan","Kurniawan","Pratama","Lestari","Utami","Rahayu","Wibowo","Halim","Firdaus","Maulana","Anggraini","Permata","Suryadi","Ramadhan","Purnama","Handayani","Susanti","Puspita","Gunawan","Hartono","Wardana","Syahputra","Ananta","Cahyono","Dharma"];

// Kode provinsi (11–94) yang lazim di NIK.
const PROV = ["11","12","13","14","15","16","17","18","19","21","31","32","33","34","35","36","51","52","53","61","62","63","64","65","71","72","73","74","75","76","81","82","91","94"];
// Awalan nomor seluler Indonesia.
const HP_PREFIX = ["811","812","813","821","822","823","851","852","853","857","858","877","878","895","896","897","898","899","819","838"];

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const rnd = (n) => Math.floor(Math.random() * n);
const d2 = (n) => String(n).padStart(2, "0");
const d4 = (n) => String(n).padStart(4, "0");

function genNIK(gender) {
  const prov = pick(PROV);
  const kabkota = d2(1 + rnd(70));
  const kec = d2(1 + rnd(30));
  let day = 1 + rnd(28);
  if (gender === "P") day += 40; // penanda perempuan pada NIK
  const month = 1 + rnd(12);
  const year = d2(rnd(100));
  const seq = d4(1 + rnd(9998));
  return prov + kabkota + kec + d2(day) + d2(month) + year + seq;
}

function genPhone() {
  let s = "0" + pick(HP_PREFIX);
  const extra = 6 + rnd(3); // total 10–12 digit
  for (let i = 0; i < extra; i++) s += rnd(10);
  return s;
}

// ── Bangkitkan N peserta unik & valid ────────────────────────────────────────
const seen = new Set();
const rows = [];
let guard = 0;
while (rows.length < N && guard < N * 50) {
  guard++;
  const gender = Math.random() < 0.5 ? "L" : "P";
  const nik = genNIK(gender);
  if (seen.has(nik)) continue;
  const v = validateNIK(nik);
  if (!v.ok) continue;
  const hp = genPhone();
  if (!validatePhone(hp).ok) continue;
  seen.add(nik);
  const nama =
    (gender === "L" ? pick(MALE) : pick(FEMALE)) + " " + pick(LAST);
  rows.push({ nama, gender: v.gender, nik, hp });
}
if (rows.length < N) {
  console.error(`Hanya berhasil membuat ${rows.length}/${N} entri unik.`);
}

// ── Output ───────────────────────────────────────────────────────────────────
function csvCell(s) {
  return `"${String(s).replace(/"/g, '""')}"`;
}

if (MODE === "csv") {
  const secret = process.env.DATA_SECRET;
  if (!secret || secret.length < 16) {
    console.error(
      "ERROR: set DATA_SECRET (string acak ≥32 karakter, sama dengan yang di Vercel) untuk mode csv."
    );
    process.exit(1);
  }

  const header = ["nama", "gender", "nik_hash", "nik_enc", "hp_hash", "hp_enc"];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        csvCell(r.nama),
        csvCell(r.gender),
        csvCell(hmac("nik:" + r.nik)),
        csvCell(encrypt(r.nik)),
        csvCell(hmac("hp:" + r.hp)),
        csvCell(encrypt(r.hp)),
      ].join(",")
    );
  }
  writeFileSync("seed_participants.csv", lines.join("\n"));

  const plain = ["nama,gender,hp,nik"];
  for (const r of rows) {
    plain.push([csvCell(r.nama), csvCell(r.gender), csvCell(r.hp), csvCell(r.nik)].join(","));
  }
  writeFileSync("seed_plain.csv", plain.join("\n"));

  console.log(`✔ ${rows.length} entri ditulis:`);
  console.log("  • seed_participants.csv  → impor ke tabel participants di Supabase");
  console.log("  • seed_plain.csv         → referensi NIK/HP asli untuk pengetesan manual");
} else if (MODE === "api") {
  const APP = (process.env.APP_URL || "").replace(/\/$/, "");
  if (!APP) {
    console.error("ERROR: set APP_URL (mis. https://namaapp.vercel.app) untuk mode api.");
    process.exit(1);
  }
  const CONCURRENCY = parseInt(process.env.CONCURRENCY || "10", 10);
  let ok = 0, dup = 0, fail = 0, done = 0;
  let idx = 0;

  async function worker() {
    while (idx < rows.length) {
      const r = rows[idx++];
      try {
        const res = await fetch(`${APP}/api/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nama: r.nama, hp: r.hp, nik: r.nik }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) data.duplicate ? dup++ : ok++;
        else fail++;
      } catch {
        fail++;
      }
      done++;
      if (done % 100 === 0) console.log(`  …${done}/${rows.length} (ok:${ok} dup:${dup} gagal:${fail})`);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log(`✔ Selesai. Terdaftar:${ok} duplikat:${dup} gagal:${fail}`);
} else {
  console.error(`MODE '${MODE}' tidak dikenal. Gunakan MODE=csv atau MODE=api.`);
  process.exit(1);
}
