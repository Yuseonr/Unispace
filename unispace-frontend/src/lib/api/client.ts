export type ApiErrorPayload = {
  code?: string;
  message?: string;
  details?: Array<{ field?: string; messages?: string[] }>;
};

type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: ApiErrorPayload;
};

export class ApiError extends Error {
  code?: string;
  details?: ApiErrorPayload["details"];
  status: number;

  constructor(status: number, error?: ApiErrorPayload) {
    super(error?.message ?? "Terjadi kendala saat menghubungi layanan Unispace.");
    this.name = "ApiError";
    this.status = status;
    this.code = error?.code;
    this.details = error?.details;
  }
}

type ApiRequestOptions = Omit<RequestInit, "body" | "headers"> & {
  accessToken?: string | null;
  body?: BodyInit | Record<string, unknown> | null;
  headers?: HeadersInit;
};

export type ApiFile = {
  blob: Blob;
  filename: string | null;
};

const apiBaseUrl = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001").replace(/\/$/, "");

function isBodyInit(value: ApiRequestOptions["body"]): value is BodyInit {
  return value instanceof FormData || value instanceof URLSearchParams || typeof value === "string" || value instanceof Blob;
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { accessToken, body, headers, ...requestOptions } = options;
  const nextHeaders = new Headers(headers);
  let requestBody: BodyInit | undefined;

  if (body && isBodyInit(body)) {
    requestBody = body;
  } else if (body !== undefined && body !== null) {
    nextHeaders.set("Content-Type", "application/json");
    requestBody = JSON.stringify(body);
  }

  if (accessToken) {
    nextHeaders.set("Authorization", `Bearer ${accessToken}`);
  }

  const response = await fetch(`${apiBaseUrl}/api/v1${path}`, {
    ...requestOptions,
    body: requestBody,
    credentials: "include",
    headers: nextHeaders,
  });
  const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;

  if (!response.ok || !payload?.success) {
    throw new ApiError(response.status, payload?.error);
  }

  return payload.data as T;
}

export async function fetchApiFile(path: string, options: ApiRequestOptions = {}): Promise<ApiFile> {
  const { accessToken, body, headers, ...requestOptions } = options;
  const nextHeaders = new Headers(headers);
  let requestBody: BodyInit | undefined;

  if (body && isBodyInit(body)) {
    requestBody = body;
  } else if (body !== undefined && body !== null) {
    nextHeaders.set("Content-Type", "application/json");
    requestBody = JSON.stringify(body);
  }
  if (accessToken) nextHeaders.set("Authorization", `Bearer ${accessToken}`);

  const response = await fetch(`${apiBaseUrl}/api/v1${path}`, {
    ...requestOptions,
    body: requestBody,
    credentials: "include",
    headers: nextHeaders,
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as ApiEnvelope<never> | null;
    throw new ApiError(response.status, payload?.error);
  }
  const disposition = response.headers.get("Content-Disposition");
  const encodedName = disposition?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const fallbackName = disposition?.match(/filename="?([^";]+)"?/i)?.[1];
  return {
    blob: await response.blob(),
    filename: encodedName ? decodeURIComponent(encodedName) : fallbackName ?? null,
  };
}

/** Mengunduh file API terautentikasi dan selalu membebaskan object URL browser. */
export async function downloadApiFile(path: string, options: ApiRequestOptions = {}) {
  const file = await fetchApiFile(path, options);
  const objectUrl = URL.createObjectURL(file.blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = file.filename ?? "unispace-download";
  anchor.style.display = "none";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
  return file;
}
