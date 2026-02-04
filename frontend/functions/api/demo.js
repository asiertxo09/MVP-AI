const RATE_LIMIT_WINDOW_MS = 2 * 60 * 1000; // 2 minutes
const MAX_NAME_LENGTH = 120;
const MAX_ORG_LENGTH = 150;
const MAX_ROLE_LENGTH = 150;
const EMAIL_REGEX = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;

export const onRequestPost = async ({ request, env }) => {
    try {
        const data = await safeJson(request);
        if (!data || typeof data !== "object") {
            await logRejection(env, getClientIdentifier(request), "invalid_json", { note: "Body is not JSON" });
            return jsonResponse({ success: false, error: "invalid_body" }, 400);
        }

        const rawNombre = ensureString(data.nombre);
        const rawEmail = ensureString(data.email);
        const rawOrg = ensureString(data.org);
        const rawRol = ensureString(data.rol);
        const honeypot = ensureString(data.demo_confirm);

        if (honeypot) {
            await logRejection(env, getClientIdentifier(request, rawEmail), "honeypot", { value: honeypot.slice(0, 32) });
            return jsonResponse({ success: false, error: "bot_detected" }, 400);
        }

        if (!rawNombre || !rawEmail || !rawOrg) {
            await logRejection(env, getClientIdentifier(request, rawEmail), "missing_fields");
            return jsonResponse({ success: false, error: "missing_fields" }, 400);
        }

        const email = normalizeEmail(rawEmail);
        if (!email) {
            await logRejection(env, getClientIdentifier(request, rawEmail), "invalid_email", { email: rawEmail });
            return jsonResponse({ success: false, error: "invalid_email" }, 400);
        }

        const nombreResult = sanitizeInput(rawNombre, MAX_NAME_LENGTH);
        const orgResult = sanitizeInput(rawOrg, MAX_ORG_LENGTH);
        const rolResult = sanitizeInput(rawRol, MAX_ROLE_LENGTH, { optional: true });

        if (nombreResult.error || orgResult.error || rolResult.error) {
            await logRejection(env, getClientIdentifier(request, email), "invalid_fields", {
                nombre: nombreResult.error || null,
                org: orgResult.error || null,
                rol: rolResult.error || null
            });
            return jsonResponse({ success: false, error: "invalid_fields" }, 400);
        }

        const nombre = nombreResult.value;
        const org = orgResult.value;
        const rol = rolResult.value;

        const identifiers = getRateLimitIdentifiers(request, email);
        const rateLimitCheck = await checkRateLimit(env, identifiers, RATE_LIMIT_WINDOW_MS);
        if (!rateLimitCheck.allowed) {
            await logRejection(env, rateLimitCheck.blockedIdentifier, "rate_limited", { windowMs: RATE_LIMIT_WINDOW_MS });
            return jsonResponse({ success: false, error: "rate_limited", retryAfter: Math.ceil(RATE_LIMIT_WINDOW_MS / 1000) }, 429);
        }

        if (!env.SENDGRID_API_KEY || !env.DEMO_FROM) {
            return jsonResponse({ success: false, error: "config_error" }, 500);
        }

        await persistLead(env, { nombre, email, org, rol: rol || null });

        const html = `
      <h3>Solicitud de demo</h3>
      <ul>
        <li><b>Nombre:</b> ${escapeHtml(nombre)}</li>
        <li><b>Email:</b> ${escapeHtml(email)}</li>
        <li><b>Organización:</b> ${escapeHtml(org)}</li>
        <li><b>Rol:</b> ${escapeHtml(rol || "-")}</li>
      </ul>`;

        const payload = {
            personalizations: [{
                to: [{ email: env.DEMO_TO || "hola@example.com" }],
                subject: "Nueva solicitud de demo"
            }],
            from: { email: env.DEMO_FROM, name: "Eduplay" },
            reply_to: { email },
            content: [
                { type: "text/plain", value: stripHtml(html) },
                { type: "text/html", value: html }
            ]
        };

        const r = await fetch("https://api.sendgrid.com/v3/mail/send", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${env.SENDGRID_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        if (!r.ok) {
            const t = await r.text();
            return jsonResponse({ success: false, error: "sendgrid_error", details: t.slice(0, 200) }, 502);
        }
        return jsonResponse({ success: true });
    } catch (err) {
        console.error("demo endpoint error", err);
        return jsonResponse({ success: false, error: "internal_error" }, 500);
    }
};

async function safeJson(request) {
    try {
        return await request.json();
    } catch {
        return null;
    }
}

function ensureString(value) {
    return typeof value === "string" ? value : "";
}

function normalizeEmail(email) {
    const trimmed = ensureString(email).normalize("NFKC").trim().toLowerCase();
    if (!trimmed || trimmed.length > 254) return "";
    if (!EMAIL_REGEX.test(trimmed)) return "";

    const parts = trimmed.split("@");
    if (parts.length !== 2) return "";
    const [local, domain] = parts;
    if (!local || !domain || local.length > 64 || domain.length > 190) return "";
    return trimmed;
}

function sanitizeInput(value, maxLength, { optional = false } = {}) {
    const normalized = ensureString(value).normalize("NFKC");
    const trimmed = normalized.trim();

    if (!trimmed) {
        return optional ? { value: "", error: null } : { value: "", error: "empty" };
    }

    let hadForbidden = false;
    let buffer = "";
    const allowedChar = /[\p{L}\p{M}\p{N}\s.,;:!¡¿?@&()'"+\-\/]/u;

    for (const char of trimmed) {
        const codePoint = char.codePointAt(0);
        if (codePoint <= 31 || codePoint === 127) {
            hadForbidden = true;
            continue;
        }

        allowedChar.lastIndex = 0;
        if (!allowedChar.test(char)) {
            hadForbidden = true;
            continue;
        }

        buffer += char;
    }

    const collapsed = buffer.replace(/\s+/g, " ").trim();

    if (!collapsed) {
        return optional ? { value: "", error: null } : { value: "", error: "empty" };
    }

    if (collapsed.length > maxLength) {
        return { value: "", error: "too_long" };
    }

    if (hadForbidden) {
        return { value: "", error: "forbidden_chars" };
    }

    return { value: collapsed, error: null };
}

function getClientIdentifier(request, email = "") {
    const ip = getClientIp(request);
    return email ? `email:${email}` : ip ? `ip:${ip}` : "unknown";
}

function getClientIp(request) {
    return (
        request.headers.get("CF-Connecting-IP") ||
        (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
        request.headers.get("x-real-ip") ||
        ""
    );
}

function getRateLimitIdentifiers(request, email) {
    const identifiers = [];
    const ip = getClientIp(request);
    if (ip) identifiers.push(`ip:${ip}`);
    if (email) identifiers.push(`email:${email}`);
    if (!identifiers.length) identifiers.push("unknown");
    return identifiers;
}

async function checkRateLimit(env, identifiers, windowMs) {
    if (!env.DB) return { allowed: true };
    const now = Date.now();
    await env.DB.prepare(
        "CREATE TABLE IF NOT EXISTS demo_rate_limits (identifier TEXT PRIMARY KEY, last_seen INTEGER)"
    ).run();

    for (const identifier of identifiers) {
        const existing = await env.DB.prepare(
            "SELECT last_seen FROM demo_rate_limits WHERE identifier = ?"
        ).bind(identifier).first();
        if (existing && now - Number(existing.last_seen) < windowMs) {
            return { allowed: false, blockedIdentifier: identifier };
        }
    }

    const statements = identifiers.map(identifier =>
        env.DB.prepare(
            "INSERT INTO demo_rate_limits (identifier, last_seen) VALUES (?, ?) ON CONFLICT(identifier) DO UPDATE SET last_seen=excluded.last_seen"
        ).bind(identifier, now)
    );
    await env.DB.batch(statements);

    return { allowed: true };
}

async function persistLead(env, { nombre, email, org, rol }) {
    if (!env.DB) return;
    await env.DB.prepare(
        "CREATE TABLE IF NOT EXISTS demo_leads (id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT, email TEXT, org TEXT, rol TEXT, created_at TEXT DEFAULT (datetime('now')))"
    ).run();
    await env.DB.prepare(
        "INSERT INTO demo_leads (nombre,email,org,rol) VALUES (?,?,?,?)"
    ).bind(nombre, email, org, rol).run();
}

async function logRejection(env, identifier, reason, details = {}) {
    if (!env.DB) {
        console.warn("demo rejection", { identifier, reason, details });
        return;
    }
    const meta = JSON.stringify(details).slice(0, 200);
    await env.DB.prepare(
        "CREATE TABLE IF NOT EXISTS demo_rejections (id INTEGER PRIMARY KEY AUTOINCREMENT, identifier TEXT, reason TEXT, details TEXT, created_at TEXT DEFAULT (datetime('now')))"
    ).run();
    await env.DB.prepare(
        "INSERT INTO demo_rejections (identifier, reason, details) VALUES (?,?,?)"
    ).bind(identifier, reason, meta).run();
}

function escapeHtml(s = "") {
    return s.replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
}

function stripHtml(s = "") {
    return s.replace(/<[^>]+>/g, "");
}

function jsonResponse(body, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" }
    });
}
