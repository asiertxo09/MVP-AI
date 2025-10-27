import { hashPassword } from "../lib/password";
import { createUser, ensureUsersTable, findUserByUsername } from "../lib/users";

export const onRequestPost = async ({ request, env }) => {
    try {
        let body;
        try {
            body = await request.json();
        } catch {
            return new Response("Solicitud inválida", { status: 400 });
        }
        const name = (body.name || "").trim();
        const username = (body.username || "").trim();
        const password = typeof body.password === "string" ? body.password : "";
        const confirm = typeof body.confirm === "string" ? body.confirm : "";
        const consent = Boolean(body.consent);

        if (!name || !username || !password || !confirm) {
            return new Response("Completa todos los campos obligatorios", { status: 400 });
        }
        if (!consent) {
            return new Response("Debes aceptar los términos para continuar", { status: 400 });
        }
        if (password.length < 8) {
            return new Response("La contraseña debe tener al menos 8 caracteres", { status: 400 });
        }
        if (password !== confirm) {
            return new Response("Las contraseñas no coinciden", { status: 400 });
        }
        if (username.length > 120 || !isValidIdentifier(username)) {
            return new Response("Formato de usuario inválido", { status: 400 });
        }
        if (name.length > 120) {
            return new Response("Nombre demasiado largo", { status: 400 });
        }

        await ensureUsersTable(env.DB);

        const existing = await findUserByUsername(env.DB, username);
        if (existing) {
            return new Response("Ya existe una cuenta con esos datos", { status: 409 });
        }

        const passwordHash = await hashPassword(password);
        await createUser(env.DB, { name, username, passwordHash });

        return new Response(JSON.stringify({ ok: true }), {
            status: 201,
            headers: { "Content-Type": "application/json" }
        });
    } catch (err) {
        console.error(err);
        return new Response("No se pudo crear la cuenta", { status: 500 });
    }
};

function isValidIdentifier(value) {
    // Acepta correos o usuarios simples (letras, números, puntos, guiones, arroba)
    return /^[A-Za-z0-9._@+-]{3,120}$/.test(value);
}
