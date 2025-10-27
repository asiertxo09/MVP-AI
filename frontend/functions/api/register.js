import { hashPassword, toColumnTuple } from "../lib/auth";

const CREATE_USERS_SQL = `
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    password_iterations INTEGER NOT NULL,
    password_algo TEXT NOT NULL DEFAULT 'pbkdf2-sha256',
    created_at TEXT DEFAULT (datetime('now'))
)`;

export const onRequestPost = async ({ request, env }) => {
    try {
        const { username, password } = await request.json();
        if (typeof username !== "string" || typeof password !== "string") {
            return new Response("Formato inválido", { status: 400 });
        }
        const trimmedUser = username.trim();
        if (!trimmedUser || password.length < 8) {
            return new Response("Usuario o contraseña inválidos", { status: 400 });
        }

        await env.DB.prepare(CREATE_USERS_SQL).run();

        const existing = await env.DB.prepare("SELECT id FROM users WHERE username = ?")
            .bind(trimmedUser)
            .first();
        if (existing) {
            return new Response("Usuario ya registrado", { status: 409 });
        }

        const hashed = await hashPassword(password);
        await env.DB.prepare(
            "INSERT INTO users (username, password_hash, password_salt, password_iterations, password_algo) VALUES (?,?,?,?,?)"
        )
            .bind(trimmedUser, ...toColumnTuple(hashed))
            .run();

        return new Response("Creado", { status: 201 });
    } catch (err) {
        console.error("register", err);
        return new Response("Error", { status: 500 });
    }
};
