const CREATE_USERS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    password_iterations INTEGER NOT NULL,
    password_algo TEXT NOT NULL DEFAULT 'pbkdf2-sha256',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

const CREATE_USERS_INDEX_SQL = `CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at)`;

export async function ensureUsersTable(db) {
    await db.prepare(CREATE_USERS_TABLE_SQL).run();
    await db.prepare(CREATE_USERS_INDEX_SQL).run();
}

export async function findUserByUsername(db, username) {
    return db
        .prepare(
            "SELECT id, username, password_hash, password_salt, password_iterations, password_algo, created_at FROM users WHERE lower(username) = lower(?)"
        )
        .bind(username)
        .first();
}

export async function createUser(db, { username, passwordHash, passwordSalt, passwordIterations, passwordAlgo }) {
    return db
        .prepare(
            "INSERT INTO users (username, password_hash, password_salt, password_iterations, password_algo, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))"
        )
        .bind(username.trim(), passwordHash, passwordSalt, passwordIterations, passwordAlgo)
        .run();
}
