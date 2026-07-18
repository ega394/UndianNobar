import { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";
import { apiGet, apiPost } from "@/lib/api";

const TOKEN_KEY = "undian_panitia_token";

// ── Tipe ─────────────────────────────────────────────────────────────────────
type Draw = {
  id: number;
  prize: string | null;
  status: "committed" | "revealed";
  seed_hash: string;
  n_winners: number;
  pool_size: number;
  winners: string[];
  committed_at: string;
  revealed_at: string | null;
};
type Stats = {
  event_name: string;
  registration_open: boolean;
  checkin_open: boolean;
  total: number;
  hadir: number;
  gender: { L: number; P: number };
  draws: Draw[];
};
type WinnerDetail = { nomor: string; raffle_number: number; nama: string; nik: string; hp: string };
type Participant = {
  nomor: string;
  raffle_number: number;
  nama: string;
  gender: string | null;
  nik: string;
  hp: string;
  created_at: string;
};

export default function Panitia() {
  const [token, setToken] = useState<string>(() => localStorage.getItem(TOKEN_KEY) || "");
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!token) {
      setChecking(false);
      return;
    }
    apiGet("panitia?op=session", token)
      .then(() => setChecking(false))
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        setToken("");
        setChecking(false);
      });
  }, [token]);

  function onLogin(t: string) {
    localStorage.setItem(TOKEN_KEY, t);
    setToken(t);
  }
  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    setToken("");
  }

  if (checking)
    return <div className="min-h-full flex items-center justify-center text-slate-400">Memuat…</div>;
  if (!token) return <Login onLogin={onLogin} />;
  return <Dashboard token={token} onLogout={logout} />;
}

// ── Login ────────────────────────────────────────────────────────────────────
function Login({ onLogin }: { onLogin: (t: string) => void }) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await apiPost<{ token: string }>("panitia?op=auth", { password });
      onLogin(res.token);
    } catch (err: any) {
      setError(err.message || "Gagal login.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-full flex items-center justify-center px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm bg-white/[0.04] border border-white/10 rounded-2xl p-6 space-y-4"
      >
        <div className="text-center">
          <div className="text-xs font-semibold tracking-widest text-indigo-300 uppercase">Panel</div>
          <h1 className="text-xl font-bold text-white mt-1">Panitia Undian</h1>
        </div>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password panitia"
          className="w-full rounded-xl bg-white/5 border border-white/12 px-4 py-3 text-white outline-none focus:border-indigo-400"
          autoFocus
        />
        {error && <div className="text-sm text-rose-300">{error}</div>}
        <button
          disabled={loading}
          className="w-full rounded-xl bg-indigo-500 hover:bg-indigo-400 disabled:opacity-60 text-white font-semibold py-3"
        >
          {loading ? "Masuk…" : "Masuk"}
        </button>
      </form>
    </div>
  );
}

// ── Dashboard ────────────────────────────────────────────────────────────────
function Dashboard({ token, onLogout }: { token: string; onLogout: () => void }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    try {
      const s = await apiGet<Stats>("panitia?op=stats", token);
      setStats(s);
      setError("");
    } catch (e: any) {
      setError(e.message || "Gagal memuat data.");
    }
  }, [token]);

  useEffect(() => {
    reload();
  }, [reload]);

  async function action<T>(fn: () => Promise<T>): Promise<T | undefined> {
    setBusy(true);
    setError("");
    try {
      const r = await fn();
      await reload();
      return r;
    } catch (e: any) {
      setError(e.message || "Gagal.");
      return undefined;
    } finally {
      setBusy(false);
    }
  }

  const committed = stats?.draws.find((d) => d.status === "committed") || null;

  return (
    <div className="min-h-full max-w-5xl mx-auto px-4 py-6">
      <header className="flex items-center justify-between mb-6">
        <div>
          <div className="text-xs font-semibold tracking-widest text-indigo-300 uppercase">Panel Panitia</div>
          <h1 className="text-xl font-bold text-white">{stats?.event_name || "Undian Nobar"}</h1>
        </div>
        <button
          onClick={onLogout}
          className="text-sm text-slate-400 hover:text-white border border-white/10 rounded-lg px-3 py-1.5"
        >
          Keluar
        </button>
      </header>

      {error && (
        <div className="mb-4 text-sm text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {/* Statistik */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Stat label="Total Pendaftar" value={stats?.total ?? "—"} />
        <Stat label="Hadir (diundi)" value={stats?.hadir ?? "—"} highlight />
        <Stat label="Laki-laki" value={stats?.gender.L ?? "—"} />
        <Stat label="Perempuan" value={stats?.gender.P ?? "—"} />
      </div>

      <EventControls stats={stats} busy={busy} action={action} token={token} />

      <DrawPanel token={token} stats={stats} committed={committed} busy={busy} action={action} />

      <ParticipantsPanel token={token} />

      <QrPanel />

      <DangerZone busy={busy} action={action} token={token} />
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number | string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 text-center ${
        highlight ? "bg-amber-500/10 border-amber-400/40" : "bg-white/[0.04] border-white/10"
      }`}
    >
      <div className={`text-2xl sm:text-3xl font-black tabular ${highlight ? "text-amber-300" : "text-white"}`}>
        {value}
      </div>
      <div className="text-[11px] uppercase tracking-wider text-slate-400 mt-1">{label}</div>
    </div>
  );
}

// ── Kontrol acara: nama acara + buka/tutup pendaftaran ──────────────────────
function EventControls({
  stats,
  busy,
  action,
  token,
}: {
  stats: Stats | null;
  busy: boolean;
  action: <T>(fn: () => Promise<T>) => Promise<T | undefined>;
  token: string;
}) {
  const [name, setName] = useState("");
  useEffect(() => {
    if (stats) setName(stats.event_name);
  }, [stats]);

  const open = stats?.registration_open;
  const checkinOpen = stats?.checkin_open;

  return (
    <Section title="Pengaturan Acara">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
        <label className="flex-1">
          <span className="block text-sm text-slate-300 mb-1">Nama Acara</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg bg-white/5 border border-white/12 px-3 py-2 text-white outline-none focus:border-indigo-400"
          />
        </label>
        <button
          disabled={busy}
          onClick={() => action(() => apiPost("panitia?op=set_event", { event_name: name }, token))}
          className="rounded-lg bg-white/10 hover:bg-white/20 text-white px-4 py-2 text-sm font-medium"
        >
          Simpan Nama
        </button>
      </div>

      <div className="flex flex-wrap gap-3 mt-3">
        <button
          disabled={busy}
          onClick={() => action(() => apiPost("panitia?op=toggle_registration", { open: !open }, token))}
          className={`rounded-lg px-4 py-2 text-sm font-semibold ${
            open ? "bg-rose-500/80 hover:bg-rose-500 text-white" : "bg-emerald-500/80 hover:bg-emerald-500 text-white"
          }`}
        >
          {open ? "Tutup Pendaftaran" : "Buka Pendaftaran"}
        </button>
        <button
          disabled={busy}
          onClick={() => action(() => apiPost("panitia?op=toggle_checkin", { open: !checkinOpen }, token))}
          className={`rounded-lg px-4 py-2 text-sm font-semibold ${
            checkinOpen ? "bg-rose-500/80 hover:bg-rose-500 text-white" : "bg-emerald-500/80 hover:bg-emerald-500 text-white"
          }`}
        >
          {checkinOpen ? "Tutup Check-in" : "Buka Check-in"}
        </button>
        <div className="flex items-center text-xs text-slate-400">
          Check-in: <b className={`ml-1 ${checkinOpen ? "text-emerald-300" : "text-slate-300"}`}>
            {checkinOpen ? "DIBUKA" : "ditutup"}
          </b>
        </div>
      </div>
    </Section>
  );
}

// ── Panel undian (commit-reveal) ─────────────────────────────────────────────
function DrawPanel({
  token,
  stats,
  committed,
  busy,
  action,
}: {
  token: string;
  stats: Stats | null;
  committed: Draw | null;
  busy: boolean;
  action: <T>(fn: () => Promise<T>) => Promise<T | undefined>;
}) {
  const [n, setN] = useState(1);
  const [prize, setPrize] = useState("");
  const [result, setResult] = useState<{ winners: WinnerDetail[]; prize: string | null } | null>(null);
  const [seedInfo, setSeedInfo] = useState<{ seed: string; seed_hash: string } | null>(null);

  async function prepare() {
    setResult(null);
    setSeedInfo(null);
    const ok = await action(() =>
      apiPost("panitia?op=prepare", { n_winners: n, prize: prize.trim() }, token)
    );
    if (ok) setPrize("");
  }
  async function reveal(id: number) {
    const r = await action(() =>
      apiPost<{ winners: WinnerDetail[]; seed: string; seed_hash: string; prize: string | null }>(
        "panitia?op=reveal",
        { id },
        token
      )
    );
    if (r) {
      setResult({ winners: r.winners, prize: r.prize });
      setSeedInfo({ seed: r.seed, seed_hash: r.seed_hash });
    }
  }
  async function cancel(id: number) {
    if (!confirm("Batalkan undian yang belum ditarik ini?")) return;
    await action(() => apiPost("panitia?op=cancel_draw", { id }, token));
  }
  async function viewRevealed(id: number) {
    const r = await apiGet<{ winners: WinnerDetail[]; seed: string; seed_hash: string; prize: string | null }>(
      `panitia?op=draw_detail&id=${id}`,
      token
    ).catch(() => null);
    if (r) {
      setResult({ winners: r.winners, prize: r.prize });
      setSeedInfo({ seed: r.seed, seed_hash: r.seed_hash });
    }
  }

  const revealedDraws = (stats?.draws || []).filter((d) => d.status === "revealed");

  return (
    <Section title="Pengundian (adil & dapat diverifikasi)">
      {!committed ? (
        <div className="space-y-3">
          <label className="block">
            <span className="block text-sm text-slate-300 mb-1">
              Hadiah / Doorprize <span className="text-slate-500">(tampil di layar publik)</span>
            </span>
            <input
              value={prize}
              onChange={(e) => setPrize(e.target.value)}
              maxLength={80}
              placeholder="mis. Sepeda Motor, Kulkas, Voucher Rp500.000"
              className="w-full rounded-lg bg-white/5 border border-white/12 px-3 py-2 text-white outline-none focus:border-amber-400"
            />
          </label>
          <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
            <label className="flex-1">
              <span className="block text-sm text-slate-300 mb-1">Jumlah pemenang ditarik</span>
              <div className="flex gap-2">
                {[1, 5, 10].map((v) => (
                  <button
                    key={v}
                    onClick={() => setN(v)}
                    className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                      n === v ? "bg-indigo-500 text-white" : "bg-white/10 text-slate-300 hover:bg-white/20"
                    }`}
                  >
                    {v}
                  </button>
                ))}
                <input
                  type="number"
                  min={1}
                  value={n}
                  onChange={(e) => setN(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-24 rounded-lg bg-white/5 border border-white/12 px-3 py-2 text-white outline-none focus:border-indigo-400 tabular"
                />
              </div>
            </label>
            <button
              disabled={busy || !stats?.total}
              onClick={prepare}
              className="rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-semibold px-4 py-2 text-sm"
            >
              🔒 Kunci Undian
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-xl bg-amber-500/10 border border-amber-500/25 p-4">
          <div className="text-amber-300 font-semibold">Undian dikunci — siap ditarik</div>
          {committed.prize && (
            <div className="text-lg font-bold text-white mt-1">🎁 {committed.prize}</div>
          )}
          <div className="text-sm text-slate-300 mt-1">
            {committed.n_winners} pemenang dari {committed.pool_size} peserta.
          </div>
          <div className="mt-2 text-[11px] text-slate-400">Kode komitmen (tampil di layar publik):</div>
          <div className="font-mono text-[11px] break-all text-amber-200/90">{committed.seed_hash}</div>
          <div className="flex gap-2 mt-3">
            <button
              disabled={busy}
              onClick={() => reveal(committed.id)}
              className="rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-semibold px-4 py-2 text-sm"
            >
              🎉 Tarik Pemenang Sekarang
            </button>
            <button
              disabled={busy}
              onClick={() => cancel(committed.id)}
              className="rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 px-4 py-2 text-sm"
            >
              Batalkan
            </button>
          </div>
        </div>
      )}

      {/* Hasil tarik terbaru (data lengkap untuk menghubungi pemenang) */}
      {result && (
        <div className="mt-4">
          <div className="text-sm font-semibold text-white mb-2">
            Pemenang{result.prize ? ` 🎁 ${result.prize}` : ""} (data lengkap — cocokkan KTP):
          </div>
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-slate-400 text-xs uppercase">
                <tr>
                  <Th>No. Undian</Th>
                  <Th>Nama</Th>
                  <Th>NIK</Th>
                  <Th>No HP</Th>
                </tr>
              </thead>
              <tbody>
                {result.winners.map((w) => (
                  <tr key={w.raffle_number} className="border-t border-white/5">
                    <Td className="font-black text-indigo-300 tabular">{w.nomor}</Td>
                    <Td className="font-medium text-white">{w.nama}</Td>
                    <Td className="tabular text-slate-300">{w.nik}</Td>
                    <Td className="tabular text-slate-300">{w.hp}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {seedInfo && (
            <div className="mt-2 text-[11px] text-slate-500 space-y-1">
              <div>
                <span className="text-slate-400">seed_hash:</span>{" "}
                <span className="font-mono break-all">{seedInfo.seed_hash}</span>
              </div>
              <div>
                <span className="text-slate-400">seed:</span>{" "}
                <span className="font-mono break-all">{seedInfo.seed}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Riwayat undian */}
      {revealedDraws.length > 0 && (
        <div className="mt-4">
          <div className="text-sm font-semibold text-slate-300 mb-2">Riwayat Undian</div>
          <ul className="space-y-2">
            {revealedDraws.map((d) => (
              <li
                key={d.id}
                className="flex items-center justify-between rounded-lg bg-white/[0.03] border border-white/10 px-3 py-2"
              >
                <div className="text-sm text-slate-300">
                  <span className="text-white font-semibold">Undian #{d.id}</span>
                  {d.prize ? <span className="text-amber-300"> 🎁 {d.prize}</span> : ""} — {d.n_winners} pemenang:{" "}
                  <span className="tabular text-indigo-300">{d.winners.join(", ")}</span>
                </div>
                <button
                  onClick={() => viewRevealed(d.id)}
                  className="text-xs text-indigo-300 hover:text-indigo-200 underline"
                >
                  Lihat data
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Section>
  );
}

// ── Tabel peserta ────────────────────────────────────────────────────────────
function ParticipantsPanel({ token }: { token: string }) {
  const [items, setItems] = useState<Participant[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(
    async (p: number, query: string) => {
      setLoading(true);
      try {
        const res = await apiGet<{ items: Participant[]; total: number }>(
          `panitia?op=participants&page=${p}&q=${encodeURIComponent(query)}`,
          token
        );
        setItems(res.items);
        setTotal(res.total);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    },
    [token]
  );

  useEffect(() => {
    load(page, q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const pages = Math.max(1, Math.ceil(total / 25));

  return (
    <Section title={`Data Peserta (${total})`}>
      <div className="flex gap-2 mb-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              setPage(1);
              load(1, q);
            }
          }}
          placeholder="Cari nama atau nomor undian…"
          className="flex-1 rounded-lg bg-white/5 border border-white/12 px-3 py-2 text-white outline-none focus:border-indigo-400"
        />
        <button
          onClick={() => {
            setPage(1);
            load(1, q);
          }}
          className="rounded-lg bg-white/10 hover:bg-white/20 text-white px-4 py-2 text-sm"
        >
          Cari
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-slate-400 text-xs uppercase">
            <tr>
              <Th>No.</Th>
              <Th>Nama</Th>
              <Th>NIK</Th>
              <Th>No HP</Th>
            </tr>
          </thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.raffle_number} className="border-t border-white/5">
                <Td className="font-black text-indigo-300 tabular">{p.nomor}</Td>
                <Td className="text-white">{p.nama}</Td>
                <Td className="tabular text-slate-300">{p.nik}</Td>
                <Td className="tabular text-slate-300">{p.hp}</Td>
              </tr>
            ))}
            {!items.length && (
              <tr>
                <td colSpan={4} className="text-center text-slate-500 py-6">
                  {loading ? "Memuat…" : "Tidak ada data."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-between mt-3 text-sm">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="rounded-lg bg-white/10 disabled:opacity-40 px-3 py-1.5"
          >
            ‹ Sebelumnya
          </button>
          <span className="text-slate-400 tabular">
            Hal {page} / {pages}
          </span>
          <button
            disabled={page >= pages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-lg bg-white/10 disabled:opacity-40 px-3 py-1.5"
          >
            Berikutnya ›
          </button>
        </div>
      )}

    </Section>
  );
}

// ── Generator QR untuk poster pendaftaran ────────────────────────────────────
function QrPanel() {
  const [url, setUrl] = useState("");
  const [png, setPng] = useState("");

  useEffect(() => {
    setUrl(`${window.location.origin}/daftar`);
  }, []);

  async function gen() {
    const dataUrl = await QRCode.toDataURL(url, { width: 512, margin: 2, errorCorrectionLevel: "M" });
    setPng(dataUrl);
  }

  return (
    <Section title="QR Pendaftaran">
      <p className="text-sm text-slate-400 mb-3">
        Buat QR menuju halaman pendaftaran, cetak untuk dipasang di lokasi. Peserta scan → isi data.
      </p>
      <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
        <label className="flex-1">
          <span className="block text-sm text-slate-300 mb-1">URL Pendaftaran</span>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="w-full rounded-lg bg-white/5 border border-white/12 px-3 py-2 text-white outline-none focus:border-indigo-400"
          />
        </label>
        <button
          onClick={gen}
          className="rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white px-4 py-2 text-sm font-medium"
        >
          Buat QR
        </button>
      </div>
      {png && (
        <div className="mt-4 flex flex-col items-center gap-3">
          <img src={png} alt="QR Pendaftaran" className="w-56 h-56 rounded-xl bg-white p-2" />
          <a
            href={png}
            download="qr-undian-nobar.png"
            className="text-sm text-indigo-300 hover:text-indigo-200 underline"
          >
            Unduh QR (PNG)
          </a>
        </div>
      )}
    </Section>
  );
}

// ── Zona bahaya: hapus semua data ────────────────────────────────────────────
function DangerZone({
  busy,
  action,
  token,
}: {
  busy: boolean;
  action: <T>(fn: () => Promise<T>) => Promise<T | undefined>;
  token: string;
}) {
  const [confirm, setConfirm] = useState("");
  return (
    <Section title="Hapus Data (Pasca-Acara)" danger>
      <p className="text-sm text-slate-400 mb-3">
        Menghapus <b>seluruh</b> data peserta dan hasil undian secara permanen. Lakukan setelah acara selesai.
        Ketik <b>HAPUS</b> untuk konfirmasi.
      </p>
      <div className="flex gap-2">
        <input
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="HAPUS"
          className="flex-1 rounded-lg bg-white/5 border border-rose-500/30 px-3 py-2 text-white outline-none focus:border-rose-400"
        />
        <button
          disabled={busy || confirm !== "HAPUS"}
          onClick={async () => {
            await action(() => apiPost("panitia?op=purge", { confirm }, token));
            setConfirm("");
          }}
          className="rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white px-4 py-2 text-sm font-semibold"
        >
          Hapus Semua Data
        </button>
      </div>
    </Section>
  );
}

// ── Komponen kecil ───────────────────────────────────────────────────────────
function Section({
  title,
  children,
  danger,
}: {
  title: string;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <section
      className={`rounded-2xl border p-5 mb-6 ${
        danger ? "bg-rose-500/[0.04] border-rose-500/20" : "bg-white/[0.03] border-white/10"
      }`}
    >
      <h2 className={`text-sm font-semibold mb-3 ${danger ? "text-rose-300" : "text-white"}`}>{title}</h2>
      {children}
    </section>
  );
}
function Th({ children }: { children: React.ReactNode }) {
  return <th className="text-left font-medium px-3 py-2">{children}</th>;
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 ${className}`}>{children}</td>;
}
