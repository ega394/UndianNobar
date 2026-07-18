-- ============================================================================
--  Undian Nobar — Skema Database Supabase (PostgreSQL)
--  Jalankan seluruh isi file ini di: Supabase Dashboard → SQL Editor → Run
-- ============================================================================

-- Peserta undian (disimpan polos — sederhana).
--  * raffle_number : nomor undian, otomatis & unik (identity) → 1, 2, 3, ...
--  * nik           : NIK, UNIQUE → kunci anti-dobel (1 NIK hanya bisa daftar sekali)
--  * hp            : No HP (boleh dipakai beberapa orang, dibatasi maks 3 di aplikasi)
create table if not exists participants (
  raffle_number bigint generated always as identity primary key,
  nama          text        not null,
  nik           text        not null unique,
  hp            text        not null,
  gender        text,
  hadir         boolean     not null default false,   -- true setelah check-in di lokasi
  checked_in_at timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists idx_participants_hp      on participants (hp);
create index if not exists idx_participants_created on participants (created_at);
create index if not exists idx_participants_hadir   on participants (hadir);

-- Bila tabel participants sudah terlanjur dibuat tanpa kolom kehadiran, jalankan:
alter table participants add column if not exists hadir boolean not null default false;
alter table participants add column if not exists checked_in_at timestamptz;

-- Sesi pengundian (commit-reveal, agar hasil bisa diaudit).
--  * seed_hash  : SHA-256 dari seed — ditampilkan SEBELUM penarikan (komitmen)
--  * seed       : seed acak — baru dibuka SAAT penarikan (reveal)
--  * pool       : daftar nomor undian yang berhak ikut (snapshot saat commit)
--  * winners    : daftar nomor undian pemenang (hasil deterministik dari seed)
create table if not exists draws (
  id           bigint generated always as identity primary key,
  prize        text,                                        -- nama hadiah/doorprize
  seed_hash    text        not null,
  seed         text,
  n_winners    int         not null,
  pool         jsonb       not null default '[]'::jsonb,
  winners      jsonb,
  status       text        not null default 'committed',   -- 'committed' | 'revealed'
  committed_at timestamptz not null default now(),
  revealed_at  timestamptz
);

-- Bila tabel draws sudah terlanjur dibuat tanpa kolom prize, jalankan:
alter table draws add column if not exists prize text;

-- Pengaturan acara (baris tunggal, id = 1).
create table if not exists settings (
  id                int primary key default 1,
  event_name        text        not null default 'Nonton Bareng',
  registration_open boolean     not null default true,
  checkin_open      boolean     not null default false,   -- buka/tutup check-in di lokasi
  updated_at        timestamptz not null default now(),
  constraint settings_singleton check (id = 1)
);

insert into settings (id) values (1) on conflict (id) do nothing;

-- Bila tabel settings sudah ada tanpa kolom checkin_open, jalankan:
alter table settings add column if not exists checkin_open boolean not null default false;

-- ============================================================================
--  Keamanan Row Level Security
--  Semua akses data dilakukan lewat serverless function memakai service_role
--  key (yang otomatis bypass RLS). RLS diaktifkan tanpa policy publik sehingga
--  anon key TIDAK bisa membaca/menulis tabel ini secara langsung dari browser.
-- ============================================================================
alter table participants enable row level security;
alter table draws        enable row level security;
alter table settings     enable row level security;
