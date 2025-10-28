const DEFAULT_HEADERS = {
  Accept: "application/json",
};

class ApiError extends Error {
  constructor(message, { status, code, details } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const parseBody = async (response) => {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return response.json();
  }
  return response.text();
};

async function apiFetch(path, options = {}) {
  const { method = "GET", body, headers, signal } = options;
  const requestInit = {
    method,
    credentials: "include",
    headers: {
      ...DEFAULT_HEADERS,
      ...(headers ?? {}),
    },
    signal,
  };

  if (body !== undefined) {
    if (body instanceof FormData || body instanceof Blob) {
      delete requestInit.headers["Content-Type"];
      requestInit.body = body;
    } else if (typeof body === "string") {
      requestInit.headers["Content-Type"] =
        requestInit.headers["Content-Type"] ?? "application/json";
      requestInit.body = body;
    } else {
      requestInit.headers["Content-Type"] = "application/json";
      requestInit.body = JSON.stringify(body);
    }
  }

  let response;
  try {
    response = await fetch(path, requestInit);
  } catch (error) {
    throw new ApiError(
      "No pudimos conectar con el servidor. Revisa tu red e inténtalo de nuevo.",
      {
        status: 0,
        details: error,
      },
    );
  }

  const payload = await parseBody(response).catch(() => undefined);

  if (!response.ok) {
    const message =
      (payload && payload.error) ||
      (payload && payload.message) ||
      "La petición no se pudo completar.";
    throw new ApiError(message, {
      status: response.status,
      details: payload,
    });
  }

  return {
    ok: true,
    status: response.status,
    data: payload,
  };
}

const get = (path, options) =>
  apiFetch(path, { ...(options ?? {}), method: "GET" });
const post = (path, body, options) =>
  apiFetch(path, { ...(options ?? {}), method: "POST", body });
const del = (path, options) =>
  apiFetch(path, { ...(options ?? {}), method: "DELETE" });

export { apiFetch, get, post, del, ApiError };
