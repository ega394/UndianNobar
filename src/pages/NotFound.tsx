import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="min-h-full flex flex-col items-center justify-center text-center px-4">
      <div className="text-6xl font-black text-white/20 tabular">404</div>
      <p className="mt-2 text-slate-400">Halaman tidak ditemukan.</p>
      <Link to="/" className="mt-4 text-indigo-400 hover:text-indigo-300 underline">
        Ke halaman pendaftaran
      </Link>
    </div>
  );
}
