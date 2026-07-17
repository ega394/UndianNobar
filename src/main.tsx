import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./index.css";
import Daftar from "./pages/Daftar";
import Panitia from "./pages/Panitia";
import Layar from "./pages/Layar";
import NotFound from "./pages/NotFound";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Daftar />} />
        <Route path="/daftar" element={<Daftar />} />
        <Route path="/panitia" element={<Panitia />} />
        <Route path="/layar" element={<Layar />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
);

// PWA: daftarkan service worker untuk offline shell + muat cepat.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
