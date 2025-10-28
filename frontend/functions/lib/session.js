export const SESSION_COOKIE_NAME = "session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24; // 24 horas
const encoder = new TextEncoder();

export function readSessionSecret(env) {
    const secret = typeof env?.SESSION_SECRET === "string" ? env.SESSION_SECRET.trim() : "";
    if (secret.length < 32) {
        throw new Error("SESSION_SECRET must be defined and at least 32 characters long");
    }
    return secret;
}

export async function createSessionToken({ userId, username, secret, ttlSeconds = SESSION_TTL_SECONDS }) {
    if (!userId) throw new Error("userId is required to create a session token");
    if (!username) throw new Error("username is required to create a session token");
    if (!secret) throw new Error("secret is required to create a session token");

    const exp = Math.floor(Date.now() / 1000) + Math.max(1, Math.floor(ttlSeconds));
    const payload = { sub: userId, u: username, exp };
    const token = await signPayload(payload, secret);
    return { token, payload, expiresAt: exp };
}

export function serializeSessionCookie(token, { maxAge = SESSION_TTL_SECONDS, path = "/" } = {}) {
    if (typeof token !== "string" || token.length === 0) {
        throw new TypeError("token must be a non-empty string");
    }
    const directives = [
        `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
        "HttpOnly",
        "Secure",
        "SameSite=Lax",
        `Path=${path}`,
        `Max-Age=${Math.max(0, Math.floor(maxAge))}`,
    ];
    return directives.join("; ");
}

export function serializeSessionClearCookie({ path = "/" } = {}) {
    return `${SESSION_COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=${path}; Max-Age=0`;
}

export async function verifySessionToken(token, secret) {
    try {
        if (typeof token !== "string" || token.length === 0) return null;
        if (typeof secret !== "string" || secret.length === 0) return null;

        const [b64, signature] = token.split(".");
        if (!b64 || !signature) return null;

        const key = await importSecret(secret);
        const valid = await crypto.subtle.verify("HMAC", key, hexToBytes(signature), encoder.encode(b64));
        if (!valid) return null;

        const payload = JSON.parse(atob(b64));
        if (typeof payload?.exp !== "number") return null;
        if (Math.floor(Date.now() / 1000) > payload.exp) return null;
        return payload;
    } catch (err) {
        console.error("verifySessionToken", err);
        return null;
    }
}

async function signPayload(payload, secret) {
    const key = await importSecret(secret);
    const body = btoa(JSON.stringify(payload));
    const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
    return `${body}.${bytesToHex(new Uint8Array(signature))}`;
}

async function importSecret(secret) {
    return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

function hexToBytes(hex) {
    const arr = new Uint8Array(hex.length / 2);
    for (let i = 0; i < arr.length; i++) {
        arr[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
    }
    return arr;
}

function bytesToHex(bytes) {
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
