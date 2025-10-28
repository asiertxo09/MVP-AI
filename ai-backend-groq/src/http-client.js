import { ServiceError } from './errors.js';

const DEFAULT_TIMEOUT_MS = 15_000;

function resolveAbort(timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  return { controller, timeout };
}

async function parseBody(response, parseAs) {
  if (parseAs === 'buffer') {
    return Buffer.from(await response.arrayBuffer());
  }
  if (parseAs === 'text') {
    return await response.text();
  }
  return await response.json();
}

async function buildError(url, response) {
  let payload;
  try {
    const text = await response.text();
    payload = text ? JSON.parse(text) : undefined;
  } catch {
    payload = undefined;
  }
  const message = `Request to ${url} failed with status ${response.status}`;
  return new ServiceError(message, response.status, payload);
}

export function createHttpClient(fetchImpl = globalThis.fetch) {
  if (typeof fetchImpl !== 'function') {
    throw new ServiceError('fetch implementation is required', 500);
  }

  async function request(url, { method = 'POST', body, headers = {}, timeoutMs = DEFAULT_TIMEOUT_MS, responseType = 'json' } = {}) {
    const finalHeaders = {
      Accept: responseType === 'json' ? 'application/json' : undefined,
      'Content-Type': 'application/json',
      ...headers,
    };
    if (!finalHeaders.Accept) {
      delete finalHeaders.Accept;
    }

    const payload = body !== undefined ? JSON.stringify(body) : undefined;
    const { controller, timeout } = resolveAbort(timeoutMs);
    try {
      const response = await fetchImpl(url, {
        method,
        headers: finalHeaders,
        body: payload,
        signal: controller.signal,
      });
      if (!response.ok) {
        throw await buildError(url, response);
      }
      return await parseBody(response, responseType);
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new ServiceError(`Request to ${url} timed out after ${timeoutMs}ms`, 504);
      }
      if (error instanceof ServiceError) {
        throw error;
      }
      throw new ServiceError(error.message || `Unexpected error calling ${url}`);
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    postJson: (url, body, options = {}) => request(url, { ...options, method: 'POST', body, responseType: 'json' }),
    postBinary: (url, body, options = {}) => request(url, { ...options, method: 'POST', body, responseType: 'buffer' }),
  };
}
