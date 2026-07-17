import { useEffect, useRef, useState } from "react";
import { apiGet } from "@/lib/api";

type Winner = { nomor: string; nama: string; nik_masked: string; hp_masked: string };
type Draw = {
  id: number;
  prize: string | null;
  status: "committed" | "revealed";
  seed_hash: string;
  seed: string | null;
  n_winners: number;
  pool_size: number;
  revealed_at: string | null;
  winners: Winner[];
};
type ScreenData = {
  event_name: string;
  registration_open: boolean;
  total: number;
  draw: Draw | null;
};

const LAST_ANIM_KEY = "undian_last_anim";
const POLL_MS = 2500;
const DRAW_ANIM_MS = 15000;

type Phase = "normal" | "drawing" | "reveal";

export default function Layar() {
  const [data, setData] = useState<ScreenData | null>(null);
  const [err, setErr] = useState("");
  const [phase, setPhase] = useState<Phase>("normal");
  const [handledId, setHandledId] = useState<number | null>(null);
  const dataRef = useRef<ScreenData | null>(null);
  dataRef.current = data;

  // Polling data layar
  useEffect(() => {
    let alive = true;
    async function tick() {
      try {
        const d = await apiGet<ScreenData>("screen");
        if (alive) {
          setData(d);
          setErr("");
        }
      } catch (e: any) {
        if (alive) setErr(e.message || "Gagal memuat");
      }
    }
    tick();
    const t = window.setInterval(tick, POLL_MS);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  // Tentukan fase tampilan (normal / animasi undi / pengumuman pemenang)
  useEffect(() => {
    const d = data?.draw;
    if (!d || d.status !== "revealed") {
      if (phase !== "drawing") setPhase("normal");
      return;
    }
    if (d.id === handledId) return; // reveal ini sudah ditangani
    setHandledId(d.id);

    const lastAnim = localStorage.getItem(LAST_ANIM_KEY);
    const fresh = d.revealed_at ? Date.now() - Date.parse(d.revealed_at) < 60000 : false;
    if (lastAnim === String(d.id) || !fresh) {
      setPhase("reveal"); // sudah pernah dianimasikan / reveal lama → langsung tampil
    } else {
      setPhase("drawing"); // reveal baru → mainkan animasi 15 detik
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  function finishDrawing() {
    const d = dataRef.current?.draw;
    if (d) localStorage.setItem(LAST_ANIM_KEY, String(d.id));
    setPhase("reveal");
  }

  const draw = data?.draw || null;

  return (
    <div className="min-h-full flex flex-col relative overflow-hidden bg-[#061031] text-white">
      <FieldBackdrop />

      <TopBar
        eventName={data?.event_name || "Semi Final & Final Piala Dunia 2026"}
        registrationOpen={!!data?.registration_open}
      />

      <main className="relative z-10 flex-1 flex flex-col px-6 pb-3">
        {err && <div className="text-rose-300 text-sm mt-2">{err}</div>}

        {phase === "drawing" && draw ? (
          <DrawingShow prize={draw.prize} count={draw.n_winners} poolSize={draw.pool_size} onDone={finishDrawing} />
        ) : phase === "reveal" && draw && draw.winners.length ? (
          <WinnersStage draw={draw} total={data?.total || 0} />
        ) : (
          <IdleStage total={data?.total ?? null} draw={draw} />
        )}
      </main>

      <Ticker />

      <style>{`
        @keyframes marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        @keyframes floaty { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-14px); } }
        @keyframes shine { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
      `}</style>
    </div>
  );
}

/* ── Latar belakang bertema lapangan / Piala Dunia ─────────────────────────── */
function FieldBackdrop() {
  return (
    <div className="absolute inset-0 z-0 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-[#0a1c5c] via-[#08153f] to-[#050b22]" />
      <div className="absolute -top-40 -right-40 w-[46rem] h-[46rem] rounded-full bg-[#1f3fa0] opacity-30 blur-3xl" />
      <div className="absolute -bottom-52 -left-40 w-[46rem] h-[46rem] rounded-full bg-[#c81e2b] opacity-20 blur-3xl" />
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 text-[40rem] leading-none opacity-[0.04] select-none" style={{ animation: "floaty 6s ease-in-out infinite" }}>
        ⚽
      </div>
    </div>
  );
}

/* ── Bilah judul emas (mengikuti poster) ──────────────────────────────────── */
function TopBar({ eventName, registrationOpen }: { eventName: string; registrationOpen: boolean }) {
  return (
    <header className="relative z-10">
      <div className="bg-gradient-to-r from-[#f2a100] via-[#ffcb2e] to-[#ef8f00] px-6 py-3 flex items-center justify-between shadow-lg">
        <div className="leading-none">
          <div className="text-2xl sm:text-4xl font-black tracking-tight text-[#0a1c5c] drop-shadow-sm italic">
            NOBAR TARAKAN HIBOT
          </div>
          <div className="text-[11px] sm:text-sm font-bold text-[#0a1c5c]/80 mt-0.5 uppercase tracking-wide">
            {eventName}
          </div>
        </div>
        <div className="text-4xl sm:text-5xl" style={{ animation: "floaty 4s ease-in-out infinite" }}>
          🏆
        </div>
      </div>
      <div className="bg-[#c81e2b] h-1.5" />
      <div className="flex justify-end px-6 mt-2">
        <span
          className={`inline-flex items-center gap-2 text-xs font-bold px-3 py-1 rounded-full ${
            registrationOpen ? "bg-emerald-500/20 text-emerald-300" : "bg-white/10 text-slate-300"
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-current" />
          {registrationOpen ? "Pendaftaran Dibuka" : "Pendaftaran Ditutup"}
        </span>
      </div>
    </header>
  );
}

/* ── Ticker bawah ──────────────────────────────────────────────────────────── */
function Ticker() {
  const text = "GRATIS  •  TERBUKA UNTUK UMUM  •  BANJIR DOORPRIZE  •  PEMERINTAH KOTA TARAKAN  •  ";
  return (
    <footer className="relative z-10 bg-[#c81e2b] overflow-hidden whitespace-nowrap">
      <div className="inline-block py-2" style={{ animation: "marquee 22s linear infinite" }}>
        <span className="text-sm font-bold tracking-wide text-white">{text.repeat(6)}</span>
        <span className="text-sm font-bold tracking-wide text-white">{text.repeat(6)}</span>
      </div>
    </footer>
  );
}

/* ── Tampilan diam: counter + status doorprize berikutnya ─────────────────── */
function IdleStage({ total, draw }: { total: number | null; draw: Draw | null }) {
  const committed = draw?.status === "committed";
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center gap-6 mt-2">
      <div>
        <div className="text-sm uppercase tracking-[0.3em] text-amber-300/90 font-semibold">Total Pendaftar</div>
        <div
          className="text-[26vw] lg:text-[15rem] leading-none font-black tabular my-2"
          style={{
            backgroundImage: "linear-gradient(120deg,#ffe082,#ffc72c,#ff9e00,#ffc72c,#ffe082)",
            backgroundSize: "200% auto",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
            animation: "shine 5s linear infinite",
          }}
        >
          {total ?? "—"}
        </div>
        <div className="text-slate-300 text-lg">peserta sudah dapat nomor undian</div>
      </div>

      {committed && draw && (
        <div className="w-full max-w-3xl rounded-2xl bg-[#0a1c5c]/70 border-2 border-amber-400/50 p-5 animate-pulse">
          <div className="text-amber-300 font-black text-2xl">🎁 SIAP DIUNDI</div>
          {draw.prize && (
            <div className="text-3xl sm:text-4xl font-black text-white mt-1">{draw.prize}</div>
          )}
          <div className="text-slate-300 mt-2">
            {draw.n_winners} pemenang akan diundi dari {draw.pool_size} peserta
          </div>
          <div className="mt-2 text-[10px] text-slate-400">Kode komitmen (SHA-256):</div>
          <div className="font-mono text-[10px] break-all text-amber-200/80">{draw.seed_hash}</div>
        </div>
      )}

      {!committed && (
        <div className="text-2xl sm:text-3xl font-black text-amber-300" style={{ animation: "floaty 4s ease-in-out infinite" }}>
          ⚽ Banjir DOORPRIZE ⚽
        </div>
      )}
    </div>
  );
}

/* ── Animasi undi 15 detik (tontonan) ─────────────────────────────────────── */
function DrawingShow({
  prize,
  count,
  poolSize,
  onDone,
}: {
  prize: string | null;
  count: number;
  poolSize: number;
  onDone: () => void;
}) {
  const [, force] = useState(0);
  const [remaining, setRemaining] = useState(Math.round(DRAW_ANIM_MS / 1000));
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const spin = window.setInterval(() => force((n) => n + 1), 65);
    const cd = window.setInterval(() => setRemaining((r) => (r > 0 ? r - 1 : 0)), 1000);
    const done = window.setTimeout(() => onDoneRef.current(), DRAW_ANIM_MS);
    return () => {
      clearInterval(spin);
      clearInterval(cd);
      clearTimeout(done);
    };
  }, []);

  const reels = Math.min(Math.max(count, 1), 5);
  const rnd4 = () => String(Math.floor(Math.random() * 10000)).padStart(4, "0");
  const pct = ((DRAW_ANIM_MS / 1000 - remaining) / (DRAW_ANIM_MS / 1000)) * 100;

  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center gap-6">
      <div className="text-6xl" style={{ animation: "floaty 1.2s ease-in-out infinite" }}>🥁</div>
      <div>
        <div className="text-amber-300 text-2xl sm:text-3xl font-black tracking-wide uppercase animate-pulse">
          Sedang Mengundi…
        </div>
        {prize && <div className="text-4xl sm:text-6xl font-black text-white mt-1">🎁 {prize}</div>}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
        {Array.from({ length: reels }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl bg-gradient-to-br from-[#f2a100] via-[#ffcb2e] to-[#ef8f00] p-[3px] shadow-2xl"
          >
            <div className="rounded-[calc(1rem-3px)] bg-[#061031] px-4 sm:px-6 py-4 sm:py-6">
              <div className="text-5xl sm:text-7xl font-black tabular text-amber-300 blur-[0.5px]">
                {rnd4()}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="w-full max-w-2xl">
        <div className="flex justify-between text-sm text-slate-300 mb-1">
          <span>Mengocok {poolSize} peserta…</span>
          <span className="tabular font-bold text-amber-300">{remaining}s</span>
        </div>
        <div className="h-3 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-amber-400 to-amber-200 transition-all duration-1000 ease-linear"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}

/* ── Pengumuman pemenang ───────────────────────────────────────────────────── */
function WinnersStage({ draw, total }: { draw: Draw; total: number }) {
  const many = draw.winners.length;
  return (
    <div className="flex-1 flex flex-col items-center justify-center mt-1">
      <div className="text-center mb-4 animate-fade-up">
        <div className="text-3xl sm:text-4xl font-black text-amber-300">🎉 SELAMAT PEMENANG!</div>
        {draw.prize && (
          <div className="mt-1 inline-block rounded-full bg-[#c81e2b] px-5 py-1.5 text-xl sm:text-2xl font-black text-white">
            🎁 {draw.prize}
          </div>
        )}
        <div className="text-slate-300 text-sm mt-2">
          Diundi dari {draw.pool_size} peserta{total ? ` (total ${total} pendaftar)` : ""}
        </div>
      </div>

      <div
        className={`grid gap-3 sm:gap-4 w-full max-w-6xl ${
          many <= 1 ? "grid-cols-1 max-w-md" : many <= 4 ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3"
        }`}
      >
        {draw.winners.map((w, i) => (
          <div
            key={w.nomor}
            className="rounded-2xl bg-gradient-to-br from-[#f2a100] via-[#ffcb2e] to-[#ef8f00] p-[3px] shadow-xl animate-pop"
            style={{ animationDelay: `${i * 90}ms` }}
          >
            <div className="rounded-[calc(1rem-3px)] bg-[#0a1c5c] px-5 py-5 text-center">
              <div className="text-5xl font-black tabular text-amber-300">{w.nomor}</div>
              <div className="mt-1.5 text-lg font-bold text-white truncate">{w.nama}</div>
              <div className="mt-2 pt-2 border-t border-white/10 flex justify-center gap-4 text-[11px] text-slate-300 tabular">
                <span>NIK {w.nik_masked}</span>
                <span>HP {w.hp_masked}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <details className="mt-6 text-center max-w-2xl">
        <summary className="cursor-pointer text-xs text-slate-400 hover:text-slate-200">
          Bukti keadilan undian (seed & kode komitmen)
        </summary>
        <div className="mt-2 text-left rounded-xl bg-white/[0.03] border border-white/10 p-4 space-y-2">
          <KV label="Kode komitmen (SHA-256 dari seed)" value={draw.seed_hash} />
          <KV label="Seed (dibuka setelah penarikan)" value={draw.seed || "—"} />
          <p className="text-[11px] text-slate-500">
            Verifikasi: untuk tiap nomor peserta hitung SHA-256("seed:NNNN"), urutkan menaik, {draw.n_winners} skor
            terkecil adalah pemenang. Kode komitmen tampil sebelum seed dibuka → hasil tidak bisa diatur.
          </p>
        </div>
      </details>
    </div>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="font-mono text-[11px] break-all text-slate-300">{value}</div>
    </div>
  );
}
