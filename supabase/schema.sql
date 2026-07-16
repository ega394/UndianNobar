-- ============================================================================
--  Undian Nobar — Skema Database Supabase (PostgreSQL)
--  Jalankan seluruh isi file ini di: Supabase Dashboard → SQL Editor → Run
-- ============================================================================

-- Peserta undian.
--  * raffle_number : nomor undian, otomatis & unik (identity) → 1, 2, 3, ...
--  * nik_hash      : HMAC dari NIK, dipakai sebagai kunci ANTI-DOBEL (unique)
--  * nik_enc       : NIK terenkripsi (AES-256-GCM) — hanya bisa dibuka server
--  * hp_hash       : HMAC dari No HP, dipakai membatasi maks 3 pendaftaran/HP
--  * hp_enc        : No HP terenkripsi
create table if not exists participants (
  raffle_number bigint generated always as identity primary key,
  nama          text        not null,
  nik_hash      text        not null unique,
  nik_enc       text        not null,
  hp_hash       text        not null,
  hp_enc        text        not null,
  gender        text,
  created_at    timestamptz not null default now()
);

create index if not exists idx_participants_hp      on participants (hp_hash);
create index if not exists idx_participants_created on participants (created_at);

-- Sesi pengundian (commit-reveal, agar hasil bisa diaudit).
--  * seed_hash  : SHA-256 dari seed — ditampilkan SEBELUM penarikan (komitmen)
--  * seed       : seed acak — baru dibuka SAAT penarikan (reveal)
--  * pool       : daftar nomor undian yang berhak ikut (snapshot saat commit)
--  * winners    : daftar nomor undian pemenang (hasil deterministik dari seed)
create table if not exists draws (
  id           bigint generated always as identity primary key,
  seed_hash    text        not null,
  seed         text,
  n_winners    int         not null,
  pool         jsonb       not null default '[]'::jsonb,
  winners      jsonb,
  status       text        not null default 'committed',   -- 'committed' | 'revealed'
  committed_at timestamptz not null default now(),
  revealed_at  timestamptz
);

-- Pengaturan acara (baris tunggal, id = 1).
create table if not exists settings (
  id                int primary key default 1,
  event_name        text        not null default 'Nonton Bareng',
  registration_open boolean     not null default true,
  updated_at        timestamptz not null default now(),
  constraint settings_singleton check (id = 1)
);

insert into settings (id) values (1) on conflict (id) do nothing;

-- ============================================================================
--  Keamanan Row Level Security
--  Semua akses data dilakukan lewat serverless function memakai service_role
--  key (yang otomatis bypass RLS). RLS diaktifkan tanpa policy publik sehingga
--  anon key TIDAK bisa membaca/menulis tabel ini secara langsung dari browser.
-- ============================================================================
alter table participants enable row level security;
alter table draws        enable row level security;
alter table settings     enable row level security;
