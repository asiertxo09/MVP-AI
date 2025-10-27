export async function ensureUsersTable(db) {
    await db.prepare(
        "CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, username TEXT UNIQUE, password TEXT, created_at TEXT DEFAULT (datetime('now')))"
    ).run();
}

export async function findUserByUsername(db, username) {
    return db.prepare(
        "SELECT id, name, username, password FROM users WHERE lower(username) = lower(?)"
    ).bind(username).first();
}

export async function createUser(db, { name, username, passwordHash }) {
    return db.prepare(
        "INSERT INTO users (name, username, password, created_at) VALUES (?, ?, ?, datetime('now'))"
    ).bind(name, username, passwordHash).run();
}
