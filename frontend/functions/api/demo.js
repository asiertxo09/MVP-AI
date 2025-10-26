export const onRequestPost = async ({ request, env }) => {
    try {
        const { nombre, email, org, rol } = await request.json();
        if (!nombre || !email || !org) return new Response("Missing fields", { status: 400 });

        // Optional: store in D1
        try {
            await env.DB.prepare(
                "CREATE TABLE IF NOT EXISTS demo_leads (id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT, email TEXT, org TEXT, rol TEXT, created_at TEXT DEFAULT (datetime('now')))"
            ).run();
            await env.DB.prepare(
                "INSERT INTO demo_leads (nombre,email,org,rol) VALUES (?,?,?,?)"
            ).bind(nombre, email, org, rol || null).run();
        } catch (_) {}

        if (!env.SENDGRID_API_KEY || !env.DEMO_FROM)
            return new Response("Config error (SENDGRID_API_KEY/DEMO_FROM)", { status: 500 });

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
            from: { email: env.DEMO_FROM, name: "Eduplay" }, // MUST equal your verified sender
            reply_to: { email }, // so you can hit "Reply" to contact the requester
            content: [
                { type: "text/plain", value: stripHtml(html) }, // good for deliverability
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
            return new Response(`SendGrid error: ${t}`, { status: 502 });
        }
        return new Response("OK", { status: 200 });
    } catch {
        return new Response("Internal error", { status: 500 });
    }
};

function escapeHtml(s=""){return s.replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));}
function stripHtml(s=""){return s.replace(/<[^>]+>/g,"");}
