import { useState } from "react";
import { apiPost } from "@/lib/api";

type Ticket = {
  ok: boolean;
  duplicate?: boolean;
  nomor: string;
  nama: string;
  nik_masked: string;
  hp_masked: string;
  event_name: string;
  message?: string;
};

export default function Daftar() {
  const [nama, setNama] = useState("");
  const [hp, setHp] = useState("");
  const [nik, setNik] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [ticket, setTicket] = useState<Ticket | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!nama.trim() || !hp.trim() || nik.replace(/\D/g, "").length !== 16) {
      setError("Lengkapi semua data. NIK harus 16 digit.");
      return;
    }
    setLoading(true);
    try {
      const res = await apiPost<Ticket>("register", { nama, hp, nik });
      setTicket(res);
    } catch (err: any) {
      setError(err.message || "Gagal mendaftar.");
    } finally {
      setLoading(false);
    }
  }

  if (ticket) return <TicketView ticket={ticket} />;

  return (
    <div className="min-h-full bg-gradient-to-b from-[#0b1020] via-[#111a34] to-[#0b1020] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md animate-fade-up">
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 text-xs font-semibold tracking-widest text-indigo-300/80 uppercase mb-3">
            🎬 Undian Nonton Bareng
          </div>
          <h1 className="text-2xl font-extrabold text-white">Pendaftaran Undian</h1>
          <p className="text-sm text-slate-400 mt-1">
            Isi data di bawah untuk mendapatkan nomor undianmu.
          </p>
        </div>

        <form
          onSubmit={submit}
          className="bg-white/[0.04] border border-white/10 rounded-2xl p-5 backdrop-blur space-y-4 shadow-2xl"
        >
          <Field label="Nama Lengkap">
            <input
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              placeholder="Nama sesuai KTP"
              maxLength={60}
              className="input"
              autoComplete="name"
            />
          </Field>

          <Field label="Nomor HP" hint="Boleh pakai HP orang lain (maks. 3 orang / HP)">
            <input
              value={hp}
              onChange={(e) => setHp(e.target.value.replace(/[^\d+]/g, ""))}
              placeholder="08xxxxxxxxxx"
              inputMode="numeric"
              className="input"
              autoComplete="tel"
            />
          </Field>

          <Field label="NIK (16 digit)" hint="Data patokan utama — 1 NIK hanya bisa daftar sekali">
            <input
              value={nik}
              onChange={(e) => setNik(e.target.value.replace(/\D/g, "").slice(0, 16))}
              placeholder="16 digit angka pada KTP"
              inputMode="numeric"
              className="input tabular"
            />
            <div className="mt-1 text-right text-[11px] text-slate-500 tabular">
              {nik.replace(/\D/g, "").length}/16
            </div>
          </Field>

          {error && (
            <div className="text-sm text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-indigo-500 hover:bg-indigo-400 disabled:opacity-60 text-white font-semibold py-3 transition shadow-lg shadow-indigo-500/30"
          >
            {loading ? "Memproses…" : "Ambil Nomor Undian"}
          </button>

          <p className="text-[11px] leading-relaxed text-slate-500 text-center">
            Data NIK & No HP disimpan terenkripsi, disensor di layar publik, dan dihapus setelah acara.
          </p>
        </form>
      </div>

      <style>{`
        .input {
          width: 100%;
          border-radius: 0.75rem;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.12);
          padding: 0.75rem 0.9rem;
          color: #fff;
          font-size: 1rem;
          outline: none;
          transition: border-color .15s, box-shadow .15s;
        }
        .input::placeholder { color: #64748b; }
        .input:focus {
          border-color: #818cf8;
          box-shadow: 0 0 0 3px rgba(129,140,248,0.25);
        }
      `}</style>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-slate-200 mb-1.5">{label}</span>
      {children}
      {hint && <span className="block mt-1 text-[11px] text-slate-500">{hint}</span>}
    </label>
  );
}

function TicketView({ ticket }: { ticket: Ticket }) {
  return (
    <div className="min-h-full bg-gradient-to-b from-[#0b1020] via-[#1a1440] to-[#0b1020] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md animate-pop">
        {ticket.duplicate && (
          <div className="mb-3 text-center text-sm text-amber-200 bg-amber-500/10 border border-amber-500/25 rounded-xl px-4 py-2">
            NIK ini sudah terdaftar sebelumnya — ini nomor undianmu.
          </div>
        )}

        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 p-[2px] shadow-2xl shadow-violet-900/50">
          <div className="rounded-[calc(1.5rem-2px)] bg-[#0d1226] px-6 py-8 text-center">
            <div className="text-xs font-semibold tracking-widest text-indigo-300 uppercase">
              {ticket.event_name}
            </div>
            <div className="mt-1 text-sm text-slate-400">Nomor Undian Kamu</div>

            <div className="my-5">
              <div className="text-6xl sm:text-7xl font-black text-white tabular tracking-tight leading-none">
                {ticket.nomor}
              </div>
            </div>

            <div className="text-lg font-bold text-white">{ticket.nama}</div>

            <div className="mt-4 grid grid-cols-2 gap-2 text-left">
              <Info label="NIK" value={ticket.nik_masked} />
              <Info label="No HP" value={ticket.hp_masked} />
            </div>

            <div className="mt-6 border-t border-dashed border-white/15 pt-4">
              <p className="text-sm font-semibold text-amber-300">
                📸 Screenshot halaman ini
              </p>
              <p className="text-[12px] text-slate-400 mt-1">
                Simpan sebagai bukti. Tunjukkan nomor ini saat pengundian.
              </p>
            </div>
          </div>
        </div>

        <p className="mt-4 text-center text-[11px] text-slate-500">
          NIK & No HP sengaja disensor demi keamanan datamu.
        </p>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/5 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="text-sm font-medium text-slate-200 tabular">{value}</div>
    </div>
  );
}
