export const onRequestPost = async ({ request, env }) => {
    try {
        const { username, password } = await request.json();
        if (!username || !password) return new Response("Faltan credenciales", { status: 400 });

        // Buscar usuario en D1
        const row = await env.DB.prepare("SELECT id, username, password FROM users WHERE username = ?")
            .bind(username).first();

        if (!row) return new Response("Credenciales inválidas", { status: 401 });

        // Comparación simple (Plano). ⚠️ Te paso nota para PBKDF2 abajo.
        if (row.password !== password) return new Response("Credenciales inválidas", { status: 401 });

        // Crear token firmado (expira en 24h)
        const payload = { sub: row.id, u: row.username, exp: Math.floor(Date.now()/1000) + 60*60*24 };
        const token = await signPayload(payload, env.SESSION_SECRET);

        const headers = new Headers({
            "Set-Cookie": `session=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${60*60*24}`,
            "Content-Type": "text/plain"
        });
        return new Response("OK", { status: 200, headers });
    } catch (e) {
        return new Response("Error", { status: 500 });
    }
};

// ---- utils ----
async function signPayload(obj, secret) {
    const b64 = btoa(JSON.stringify(obj));
    const key = await crypto.subtle.importKey(
        "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
    );
    const sigBuf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(b64));
    const sigHex = [...new Uint8Array(sigBuf)].map(b=>b.toString(16).padStart(2,"0")).join("");
    return `${b64}.${sigHex}`;
}
