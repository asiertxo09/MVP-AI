// Protege /app/* verificando cookie de sesión firmada
export const onRequest = async ({ request, next, env }) => {
    const url = new URL(request.url);

    // Rutas públicas
    if (url.pathname === "/" || url.pathname === "/login" || url.pathname.startsWith("/api/")) {
        return next();
    }

    // Proteger /app/*
    if (url.pathname.startsWith("/app/")) {
        const cookie = request.headers.get("Cookie") || "";
        const match = cookie.match(/session=([^;]+)/);
        if (!match) return Response.redirect(new URL("/login", url), 302);

        const token = decodeURIComponent(match[1]);
        const ok = await verifyToken(token, env.SESSION_SECRET);
        if (!ok) return Response.redirect(new URL("/login", url), 302);
    }

    return next();
};

// ---- utils: token HMAC (no dependencias) ----
async function verifyToken(token, secret) {
    try {
        const [b64, sig] = token.split(".");
        if (!b64 || !sig) return false;
        const data = new TextEncoder().encode(b64);
        const key = await crypto.subtle.importKey(
            "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]
        );
        const ok = await crypto.subtle.verify("HMAC", key, hexToBuf(sig), data);
        if (!ok) return false;

        const payload = JSON.parse(atob(b64));
        // exp en segundos
        if (typeof payload.exp !== "number" || Date.now() / 1000 > payload.exp) return false;
        return true;
    } catch {
        return false;
    }
}

function hexToBuf(hex) {
    const arr = new Uint8Array(hex.length / 2);
    for (let i = 0; i < arr.length; i++) arr[i] = parseInt(hex.substr(i * 2, 2), 16);
    return arr.buffer;
}
