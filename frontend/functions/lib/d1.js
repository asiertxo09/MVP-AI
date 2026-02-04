export class MissingDatabaseBindingError extends Error {
    constructor(message = "D1 binding 'DB' is not configured.") {
        super(message);
        this.name = "MissingDatabaseBindingError";
        this.userMessage = "Base de datos no configurada";
    }
}

export function requireDb(env) {
    const db = env?.DB;
    if (db && typeof db.prepare === "function") {
        return db;
    }
    throw new MissingDatabaseBindingError(
        "D1 binding 'DB' is not configured. Configure it via wrangler.toml or the Cloudflare Pages project settings."
    );
}
