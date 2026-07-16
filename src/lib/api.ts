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
