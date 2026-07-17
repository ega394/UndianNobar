// Klien API tipis untuk memanggil serverless function /api/*.

export async function apiGet<T = any>(path: string, token?: string): Promise<T> {
  const r = await fetch(`/api/${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.error || `Gagal (${r.status})`);
  return data;
}

export async function apiPost<T = any>(path: string, body: unknown, token?: string): Promise<T> {
  const r = await fetch(`/api/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body ?? {}),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.error || `Gagal (${r.status})`);
  return data;
}

// Error yang menandai "jangan diulang" (kesalahan validasi/aturan, bukan jaringan).
class NoRetryError extends Error {
  noRetry = true;
}

/**
 * POST tahan jaringan lambat: timeout per percobaan + retry dengan backoff.
 * - Kesalahan validasi/aturan (400/403/409) → langsung berhenti (tidak diulang).
 * - Rate limit (429), error server (5xx), timeout, atau jaringan putus → diulang.
 */
export async function postWithRetry<T = any>(
  path: string,
  body: unknown,
  opts: {
    retries?: number;
    timeoutMs?: number;
    onAttempt?: (attempt: number, retries: number) => void;
  } = {}
): Promise<T> {
  const { retries = 5, timeoutMs = 12000, onAttempt } = opts;
  let lastErr: Error | null = null;

  for (let attempt = 1; attempt <= retries; attempt++) {
    onAttempt?.(attempt, retries);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const r = await fetch(`/api/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {}),
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      const data = await r.json().catch(() => ({}));
      if (r.ok) return data as T;

      const msg = data?.error || `Gagal (${r.status})`;
      // 4xx selain 429 = kesalahan permanen → jangan diulang.
      if (r.status >= 400 && r.status < 500 && r.status !== 429) throw new NoRetryError(msg);
      lastErr = new Error(msg); // 429 / 5xx → boleh diulang
    } catch (e: any) {
      clearTimeout(timer);
      if (e instanceof NoRetryError) throw e;
      lastErr = e instanceof Error ? e : new Error(String(e));
    }

    // Backoff sebelum percobaan berikutnya: 1s, 2s, 4s, 8s (maks 8s).
    if (attempt < retries) {
      await new Promise((res) => setTimeout(res, Math.min(1000 * 2 ** (attempt - 1), 8000)));
    }
  }
  throw lastErr || new Error("Gagal mengirim data.");
}
