const CREATE_USER_ROLES_TABLE_SQL = `
    CREATE TABLE IF NOT EXISTS user_roles (
                                              id INTEGER PRIMARY KEY AUTOINCREMENT,
                                              role_name TEXT NOT NULL UNIQUE
    )`;

const POPULATE_USER_ROLES_SQL = `INSERT OR IGNORE INTO user_roles (role_name) VALUES ('Padre'), ('Hijo'), ('Médico')`;

const CREATE_USERS_TABLE_SQL = `
    CREATE TABLE IF NOT EXISTS users (
                                         id INTEGER PRIMARY KEY AUTOINCREMENT,
                                         username TEXT NOT NULL UNIQUE COLLATE NOCASE,
                                         password_hash TEXT NOT NULL,
                                         password_salt TEXT NOT NULL,
                                         password_iterations INTEGER NOT NULL,
                                         password_algo TEXT NOT NULL DEFAULT 'pbkdf2-sha256',
                                         role_id INTEGER NOT NULL,
                                         created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (role_id) REFERENCES user_roles(id)
        )`;

const CREATE_USERS_INDEX_SQL = `CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at)`;

export async function ensureUsersTable(db) {
    await db.batch([
        db.prepare(CREATE_USER_ROLES_TABLE_SQL),
        db.prepare(POPULATE_USER_ROLES_SQL),
        db.prepare(CREATE_USERS_TABLE_SQL),
        db.prepare(CREATE_USERS_INDEX_SQL)
    ]);
}

export async function findUserByUsername(db, username) {
    return db
        .prepare(
            "SELECT u.id, u.username, u.password_hash, u.password_salt, u.password_iterations, u.password_algo, u.created_at, r.role_name FROM users u JOIN user_roles r ON u.role_id = r.id WHERE lower(u.username) = lower(?)"
        )
        .bind(username)
        .first();
}

export async function createUser(db, { username, passwordHash, passwordSalt, passwordIterations, passwordAlgo, role }) {
    console.log(role)
    const roleResult = await db.prepare("SELECT id FROM user_roles WHERE role_name = ?").bind(role).first();
    if (!roleResult) {
        throw new Error(`El rol '${role}' no es válido.`);
    }
    const roleId = roleResult.id;

    return db
        .prepare(
            "INSERT INTO users (username, password_hash, password_salt, password_iterations, password_algo, role_id) VALUES (?, ?, ?, ?, ?, ?)"
        )
        .bind(username.trim(), passwordHash, passwordSalt, passwordIterations, passwordAlgo, roleId)
        .run();
}