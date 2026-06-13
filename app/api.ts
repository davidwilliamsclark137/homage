import Constants from "expo-constants";

const API_BASE: string =
  (Constants?.expoConfig?.extra as any)?.API_BASE ??
  (Constants?.manifest?.extra as any)?.API_BASE ??
  "https://homage-backend.onrender.com";

export async function getHealth(): Promise<any> {
  const res = await fetch(`${API_BASE}/healthz`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function uploadForm(form: FormData): Promise<any> {
  const res = await fetch(`${API_BASE}/upload`, {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Upload failed (${res.status}): ${txt}`);
  }

  return res.json();
}

export async function getCompleted(): Promise<{
  count: number;
  completed: any[];
}> {
  const res = await fetch(`${API_BASE}/completed`);

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Completed fetch failed (${res.status}): ${txt}`);
  }

  return res.json();
}

export { API_BASE };
