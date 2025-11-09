// app/api.ts
import Constants from "expo-constants";

const API_BASE: string =
  (Constants.expoConfig?.extra as any)?.API_BASE ||
  // fallback to newer runtime location if needed
  (Constants as any).manifest2?.extra?.API_BASE ||
  "https://homage-backend.onrender.com";

type Json = Record<string, any>;

async function getJSON<T = Json>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "GET",
    headers: { Accept: "application/json" },
    ...init,
  });
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return (await res.json()) as T;
}

async function postForm<T = Json>(path: string, form: FormData): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    body: form, // fetch sets proper multipart boundary
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`POST ${path} failed: ${res.status} ${text}`);
  }
  return (await res.json()) as T;
}

export const api = {
  base: API_BASE,
  health: () => getJSON("/healthz"),
  listFiles: () => getJSON<{ count: number; files: string[] }>("/files"),
  uploadBlob: (blob: Blob | File, filename = "upload.bin") => {
    const form = new FormData();
    // Important: field name **must** be "file" for your FastAPI route
    form.append("file", blob as any, filename);
    return postForm<{ saved: string; size: number }>("/upload", form);
  },
};
