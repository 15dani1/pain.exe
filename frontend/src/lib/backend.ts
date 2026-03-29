const backendBaseUrl =
  process.env.BACKEND_BASE_URL ??
  process.env.NEXT_PUBLIC_BACKEND_BASE_URL ??
  "http://127.0.0.1:4000";

export function getBackendUrl(path: string) {
  return new URL(path, backendBaseUrl).toString();
}

export async function fetchBackend(
  path: string,
  init?: RequestInit,
) {
  const response = await fetch(getBackendUrl(path), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  return response;
}
