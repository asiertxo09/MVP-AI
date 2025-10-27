import { verifyPassword } from "../lib/password";
import { ensureUsersTable, findUserByUsername } from "../lib/users";

export const onRequestPost = async ({ request, env }) => {
    try {
        let body;
        try {
            body = await request.json();
        } catch {
            return new Response("Solicitud inválida", { status: 400 });
        }
        const username = typeof body.username === "string" ? body.username.trim() : "";
        const password = typeof body.password === "string" ? body.password : "";
        if (!username || !password) return new Response("Faltan credenciales", { status: 400 });

        await ensureUsersTable(env.DB);

        // Buscar usuario en D1
        const row = await findUserByUsername(env.DB, username);

        if (!row) return new Response("Credenciales inválidas", { status: 401 });

        const valid = await verifyPassword(password, row.password);
        if (!valid) return new Response("Credenciales inválidas", { status: 401 });

        // Crear token firmado (expira en 24h)
        const payload = { sub: row.id, u: row.username, exp: Math.floor(Date.now()/1000) + 60*60*24 };
        const token = await signPayload(payload, env.SESSION_SECRET);

        const headers = new Headers({
            "Set-Cookie": `session=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${60*60*24}`,
            "Content-Type": "text/plain"
        });
        return new Response("OK", { status: 200, headers });
    } catch (e) {
        console.error(e);
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
