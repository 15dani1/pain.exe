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

export async function readBackendResponse(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();
  const preview = text.slice(0, 240).trim();

  return {
    error: "Backend returned a non-JSON response",
    code: "INVALID_BACKEND_RESPONSE",
    detail: preview || `Empty response from ${response.url}`,
    upstreamStatus: response.status,
    upstreamUrl: response.url,
  };
}
