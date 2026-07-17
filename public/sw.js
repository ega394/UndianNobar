/* Service worker Undian Nobar — offline shell + muat cepat di jaringan lambat.
 * Strategi:
 *   - /api/*                 → JANGAN di-cache (harus selalu segar)
 *   - navigasi halaman (SPA) → network-first, fallback ke shell tersimpan
 *   - aset statis (hashed)   → cache-first (immutable)
 *   - font Google            → cache-first
 */
const CACHE = "undian-v1";
const ASSET_RE = /\.(?:js|css|woff2?|ttf|otf|png|jpg|jpeg|svg|webp|ico)$/;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  let url;
  try {
    url = new URL(req.url);
  } catch {
    return;
  }

  // Endpoint API tidak pernah di-cache.
  if (url.origin === self.location.origin && url.pathname.startsWith("/api/")) return;

  // Navigasi halaman → network-first, fallback shell offline.
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const net = await fetch(req);
          const cache = await caches.open(CACHE);
          cache.put("/index.html", net.clone());
          return net;
        } catch {
          const cache = await caches.open(CACHE);
          return (await cache.match("/index.html")) || Response.error();
        }
      })()
    );
    return;
  }

  // Aset statis same-origin → cache-first.
  if (url.origin === self.location.origin && ASSET_RE.test(url.pathname)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        const hit = await cache.match(req);
        if (hit) return hit;
        const net = await fetch(req);
        if (net.ok) cache.put(req, net.clone());
        return net;
      })()
    );
    return;
  }

  // Font Google (cross-origin) → cache-first.
  if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        const hit = await cache.match(req);
        if (hit) return hit;
        try {
          const net = await fetch(req);
          if (net.ok) cache.put(req, net.clone());
          return net;
        } catch {
          return hit || Response.error();
        }
      })()
    );
  }
});
