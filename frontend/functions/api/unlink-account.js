import { unlinkUser } from "../lib/users";
import { getSession } from "../lib/session";
import { requireDb } from "../lib/d1";

export const onRequestPost = async ({ request, env }) => {
    try {
        const session = await getSession(request, env);
        if (!session) {
            return jsonResponse({ error: "No autorizado" }, 401);
        }

        const db = requireDb(env);
        let body;
        try {
            body = await request.json();
        } catch {
            return jsonResponse({ error: "JSON inválido" }, 400);
        }

        const { childId } = body;
        if (!childId) {
            return jsonResponse({ error: "childId requerido" }, 400);
        }

        const supervisorId = session.sub;

        // Perform Unlink
        await unlinkUser(db, {
            supervisorId: supervisorId,
            childId: childId
        });

        return jsonResponse({ ok: true, message: "Cuenta desvinculada exitosamente" }, 200);

    } catch (err) {
        console.error("unlink-account", err);
        return jsonResponse({ error: "Error al desvincular cuenta: " + err.message }, 500);
    }
};

function jsonResponse(body, status) {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store"
        }
    });
}
