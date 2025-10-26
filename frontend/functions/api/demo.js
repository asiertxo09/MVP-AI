export const onRequestPost = async ({ request, env }) => {
    try {
        const { nombre, email, org, rol } = await request.json();

        if (!nombre || !email || !org)
            return new Response("Datos incompletos", { status: 400 });

        // Guardar lead en D1 (opcional)
        try {
            await env.DB.prepare(
                "CREATE TABLE IF NOT EXISTS demo_leads (id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT, email TEXT, org TEXT, rol TEXT, created_at TEXT DEFAULT (datetime('now')))"
            ).run();
            await env.DB.prepare(
                "INSERT INTO demo_leads (nombre,email,org,rol) VALUES (?,?,?,?)"
            ).bind(nombre, email, org, rol || null).run();
        } catch (e) {
            console.warn("D1 error", e);
        }

        // Construir correo
        const payload = {
            from: env.DEMO_FROM,
            to: env.DEMO_TO,
            subject: "Nueva solicitud de demo",
            html: `
        <h3>Solicitud de demo</h3>
        <ul>
          <li><b>Nombre:</b> ${escape(nombre)}</li>
          <li><b>Email:</b> ${escape(email)}</li>
          <li><b>Organización:</b> ${escape(org)}</li>
          <li><b>Rol:</b> ${escape(rol || "-")}</li>
        </ul>
      `
        };

        const r = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${env.RESEND_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        if (!r.ok) {
            const t = await r.text();
            return new Response("Error al enviar correo: " + t, { status: 502 });
        }

        return new Response("OK", { status: 200 });
    } catch (err) {
        return new Response("Error interno", { status: 500 });
    }
};

function escape(str = "") {
    return str.replace(/[&<>"']/g, m => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[m]));
}
