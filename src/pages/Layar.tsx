import { useEffect, useRef, useState } from "react";
import { apiGet } from "@/lib/api";

type ScreenData = {
  event_name: string;
  registration_open: boolean;
  total: number;
  recent: { nomor: string; nama: string }[];
  draw: null | {
    status: "committed" | "revealed";
    seed_hash: string;
    seed: string | null;
    n_winners: number;
    pool_size: number;
    winners: { nomor: string; nama: string }[];
  };
};

export default function Layar() {
  const [data, setData] = useState<ScreenData | null>(null);
  const [err, setErr] = useState("");
  const timer = useRef<number | null>(null);

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
    timer.current = window.setInterval(tick, 4000);
    return () => {
      alive = false;
      if (timer.current) clearInterval(timer.current);
    };
  }, []);

  const draw = data?.draw;
  const revealed = draw?.status === "revealed";

  return (
    <div className="min-h-full bg-gradient-to-br from-[#0b1020] via-[#141d3a] to-[#0b1020] px-6 py-8 flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <div className="text-xs sm:text-sm font-semibold tracking-[0.3em] text-indigo-300/80 uppercase">
            🎬 Undian Nonton Bareng
          </div>
          <h1 className="text-2xl sm:text-4xl font-black text-white mt-1">
            {data?.event_name || "Nonton Bareng"}
          </h1>
        </div>
        <div className="text-right">
          <div
            className={`inline-flex items-center gap-2 text-sm font-semibold px-3 py-1.5 rounded-full ${
              data?.registration_open
                ? "bg-emerald-500/15 text-emerald-300"
                : "bg-slate-500/15 text-slate-400"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-current" />
            {data?.registration_open ? "Pendaftaran Dibuka" : "Pendaftaran Ditutup"}
          </div>
        </div>
      </header>

      {err && <div className="mt-3 text-rose-300 text-sm">{err}</div>}

      {/* Pemenang mengambil alih layar saat sudah ditarik */}
      {revealed && draw ? (
        <WinnersStage draw={draw} eventTotal={data?.total || 0} />
      ) : (
        <main className="flex-1 grid lg:grid-cols-[1.1fr_1fr] gap-6 mt-6">
          {/* Counter */}
          <section className="rounded-3xl bg-white/[0.04] border border-white/10 p-8 flex flex-col items-center justify-center text-center">
            <div className="text-sm uppercase tracking-widest text-slate-400">Total Pendaftar</div>
            <div className="text-[22vw] lg:text-[12rem] leading-none font-black text-white tabular my-2">
              {data ? data.total : "—"}
            </div>
            <div className="text-slate-400">peserta sudah dapat nomor undian</div>

            {draw?.status === "committed" && (
              <div className="mt-6 w-full max-w-md rounded-2xl bg-amber-500/10 border border-amber-500/25 p-4">
                <div className="text-amber-300 font-semibold">🔒 Undian Dikunci</div>
                <div className="text-sm text-slate-300 mt-1">
                  {draw.n_winners} pemenang akan ditarik dari {draw.pool_size} peserta.
                </div>
                <div className="mt-2 text-[11px] text-slate-400">Kode komitmen (SHA-256):</div>
                <div className="font-mono text-[11px] break-all text-amber-200/90">
                  {draw.seed_hash}
                </div>
              </div>
            )}
          </section>

          {/* Feed pendaftar terbaru */}
          <section className="rounded-3xl bg-white/[0.04] border border-white/10 p-6 overflow-hidden">
            <div className="text-sm uppercase tracking-widest text-slate-400 mb-3">
              Pendaftar Terbaru
            </div>
            <ul className="space-y-2">
              {(data?.recent || []).slice(0, 12).map((p) => (
                <li
                  key={p.nomor}
                  className="flex items-center gap-3 rounded-xl bg-white/[0.03] px-3 py-2 animate-fade-up"
                >
                  <span className="text-lg font-black text-indigo-300 tabular w-16">{p.nomor}</span>
                  <span className="text-white font-medium truncate">{p.nama}</span>
                </li>
              ))}
              {!data?.recent?.length && (
                <li className="text-slate-500 text-sm">Belum ada pendaftar.</li>
              )}
            </ul>
          </section>
        </main>
      )}

      <footer className="mt-6 text-center text-[11px] text-slate-600">
        Undian adil & dapat diverifikasi (commit-reveal). NIK & No HP tidak pernah ditampilkan di layar ini.
      </footer>
    </div>
  );
}

function WinnersStage({
  draw,
  eventTotal,
}: {
  draw: NonNullable<ScreenData["draw"]>;
  eventTotal: number;
}) {
  return (
    <main className="flex-1 flex flex-col items-center justify-center mt-6">
      <div className="text-center mb-6 animate-fade-up">
        <div className="text-2xl sm:text-3xl font-bold text-amber-300">🎉 Selamat kepada Pemenang!</div>
        <div className="text-slate-400 text-sm mt-1">
          Ditarik dari {draw.pool_size} peserta{eventTotal ? ` dari total ${eventTotal} pendaftar` : ""}
        </div>
      </div>

      <div
        className={`grid gap-4 w-full max-w-5xl ${
          draw.winners.length <= 1
            ? "grid-cols-1"
            : draw.winners.length <= 4
              ? "sm:grid-cols-2"
              : "sm:grid-cols-2 lg:grid-cols-3"
        }`}
      >
        {draw.winners.map((w, i) => (
          <div
            key={w.nomor}
            className="rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 p-[2px] shadow-xl animate-pop"
            style={{ animationDelay: `${i * 90}ms` }}
          >
            <div className="rounded-[calc(1rem-2px)] bg-[#0d1226] px-5 py-6 text-center">
              <div className="text-5xl font-black text-white tabular">{w.nomor}</div>
              <div className="mt-2 text-lg font-bold text-white truncate">{w.nama}</div>
            </div>
          </div>
        ))}
      </div>

      <details className="mt-8 text-center max-w-2xl">
        <summary className="cursor-pointer text-xs text-slate-400 hover:text-slate-200">
          Bukti keadilan undian (seed & kode komitmen)
        </summary>
        <div className="mt-3 text-left rounded-xl bg-white/[0.03] border border-white/10 p-4 space-y-2">
          <KV label="Kode komitmen (SHA-256 dari seed)" value={draw.seed_hash} />
          <KV label="Seed (dibuka setelah penarikan)" value={draw.seed || "—"} />
          <p className="text-[11px] text-slate-500">
            Verifikasi: untuk tiap nomor peserta hitung SHA-256("seed:NNNN"). Urutkan menaik, {draw.n_winners} skor
            terkecil adalah pemenang. Karena kode komitmen ditampilkan sebelum seed dibuka, panitia tidak bisa
            mengatur hasil.
          </p>
        </div>
      </details>
    </main>
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
