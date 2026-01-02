import { getLinkedChildren } from "../lib/users";
import { requireDb, MissingDatabaseBindingError } from "../lib/d1";
import { getSession } from "../lib/session";

export const onRequestGet = async ({ request, env }) => {
    try {
        const session = await getSession(request, env);
        if (!session) {
            return jsonResponse({ error: "No autorizado" }, 401);
        }

        const db = requireDb(env);
        const supervisorId = session.sub;

        const result = await getLinkedChildren(db, supervisorId);
        const children = result.results || [];

        return jsonResponse({ children }, 200);

    } catch (err) {
        if (err instanceof MissingDatabaseBindingError) {
            console.error("children missing DB", err);
            return jsonResponse({ error: err.userMessage }, 500);
        }
        console.error("children", err);
        return jsonResponse({ error: "Error al obtener niños: " + err.message }, 500);
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
