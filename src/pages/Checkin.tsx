import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { postWithRetry } from "@/lib/api";

type Result = { ok: boolean; already?: boolean; nomor: string; nama: string; message?: string };

export default function Checkin() {
  const [params] = useSearchParams();
  const [nik, setNik] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sendMsg, setSendMsg] = useState("");
  const [result, setResult] = useState<Result | null>(null);

  // Kode bisa terisi otomatis bila peserta men-scan QR di layar.
  useEffect(() => {
    const c = params.get("c");
    if (c) setCode(c.replace(/\D/g, "").slice(0, 6));
  }, [params]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (nik.replace(/\D/g, "").length !== 16) return setError("NIK harus 16 digit.");
    if (code.replace(/\D/g, "").length !== 6) return setError("Masukkan 6 digit kode yang tampil di layar.");
    setLoading(true);
    try {
      const res = await postWithRetry<Result>(
        "checkin",
        { nik, code },
        { retries: 5, timeoutMs: 12000, onAttempt: (a) => setSendMsg(a === 1 ? "Memproses…" : `Mencoba lagi… (${a})`) }
      );
      setResult(res);
    } catch (e: any) {
      setError(e?.message || "Gagal check-in. Coba lagi.");
    } finally {
      setLoading(false);
      setSendMsg("");
    }
  }

  if (result) {
    return (
      <div className="min-h-full bg-gradient-to-b from-[#061031] via-[#0a1c5c] to-[#061031] flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md animate-pop text-center">
          <div className="rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-500 p-[2px] shadow-2xl">
            <div className="rounded-[calc(1.5rem-2px)] bg-[#081235] px-6 py-9">
              <div className="text-6xl mb-2">✅</div>
              <div className="text-2xl font-black text-emerald-300">
                {result.already ? "Sudah Check-in" : "Check-in Berhasil!"}
              </div>
              <div className="text-slate-300 mt-1 text-sm">
                {result.already ? "Anda sudah tercatat hadir." : "Anda tercatat HADIR & masuk undian."}
              </div>
              <div className="my-5">
                <div className="text-xs uppercase tracking-widest text-slate-400">Nomor Undian</div>
                <div className="text-6xl font-black text-white tabular leading-none mt-1">{result.nomor}</div>
              </div>
              <div className="text-lg font-bold text-white">{result.nama}</div>
              <p className="mt-5 text-[12px] text-slate-400">
                Simpan/screenshot ini. Pantau layar saat pengundian doorprize. 🎁
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-gradient-to-b from-[#061031] via-[#0a1c5c] to-[#061031] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md animate-fade-up">
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 text-xs font-semibold tracking-widest text-amber-300/90 uppercase mb-2">
            📍 Check-in Kehadiran
          </div>
          <h1 className="text-2xl font-extrabold text-white">Konfirmasi Kehadiran</h1>
          <p className="text-sm text-slate-300 mt-1">
            Masukkan NIK & <b>kode yang tampil di layar</b> untuk ikut undian doorprize.
          </p>
        </div>

        <form
          onSubmit={submit}
          className="bg-white/[0.05] border border-white/10 rounded-2xl p-5 space-y-4 shadow-2xl"
        >
          <label className="block">
            <span className="block text-sm font-medium text-slate-200 mb-1.5">NIK (16 digit)</span>
            <input
              value={nik}
              onChange={(e) => setNik(e.target.value.replace(/\D/g, "").slice(0, 16))}
              placeholder="NIK yang dipakai saat mendaftar"
              inputMode="numeric"
              className="cin tabular"
            />
          </label>

          <label className="block">
            <span className="block text-sm font-medium text-slate-200 mb-1.5">Kode di Layar (6 digit)</span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="● ● ● ● ● ●"
              inputMode="numeric"
              className="cin tabular text-center text-2xl tracking-[0.4em] font-black"
            />
            <span className="block mt-1 text-[11px] text-slate-400">
              Kode berganti tiap beberapa detik — lihat layar besar di lokasi.
            </span>
          </label>

          {error && (
            <div className="text-sm text-rose-200 bg-rose-500/10 border border-rose-500/25 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-70 text-black font-bold py-3 flex items-center justify-center gap-2"
          >
            {loading && (
              <span className="inline-block w-4 h-4 border-2 border-black/40 border-t-black rounded-full animate-spin" />
            )}
            {loading ? sendMsg || "Memproses…" : "Check-in Sekarang"}
          </button>
        </form>
      </div>

      <style>{`
        .cin {
          width: 100%; border-radius: 0.75rem;
          background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.14);
          padding: 0.75rem 0.9rem; color: #fff; font-size: 1rem; outline: none;
          transition: border-color .15s, box-shadow .15s;
        }
        .cin::placeholder { color: #64748b; }
        .cin:focus { border-color: #fbbf24; box-shadow: 0 0 0 3px rgba(251,191,36,0.22); }
      `}</style>
    </div>
  );
}
