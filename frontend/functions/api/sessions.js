import { requireDb } from "../lib/d1";

export const onRequestPost = async ({ request, env }) => {
    try {
        const { username } = await request.json();

        if (!username) {
            return new Response(
                JSON.stringify({ error: "username requerido" }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            );
        }

        const db = requireDb(env);

        const userStmt = db.prepare("SELECT id FROM users WHERE username = ?");
        const userResult = await userStmt.bind(username).first();

        if (!userResult) {
            return new Response(
                JSON.stringify({ error: "Usuario no encontrado" }),
                { status: 404, headers: { "Content-Type": "application/json" } }
            );
        }

        const id_user = userResult.id;
        const logDate = new Date().toISOString();

        const sessionStmt = db.prepare("INSERT INTO sessions (id_user, log_date) VALUES (?, ?)");
        await sessionStmt.bind(id_user, logDate).run();

        return new Response(
            JSON.stringify({ success: true, message: "Sesión registrada" }),
            { status: 200, headers: { "Content-Type": "application/json" } }
        );
    } catch (error) {
        console.error("Error registrando sesión:", error);
        return new Response(
            JSON.stringify({ error: "Error al registrar sesión" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }
};
