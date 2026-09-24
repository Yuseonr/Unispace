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
