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

export async function linkUser(db, { supervisorId, childId, type }) {
    // Verify roles
    const supervisor = await db.prepare("SELECT role_id FROM users WHERE id = ?").bind(supervisorId).first();
    const child = await db.prepare("SELECT role_id FROM users WHERE id = ?").bind(childId).first();

    if (!supervisor || !child) {
        throw new Error("Usuario no encontrado");
    }

    // You might want to add stricter role checks here based on role_id
    // For now assuming the logic calling this function has done some checks or we rely on the type

    return db.prepare(
        "INSERT OR IGNORE INTO user_links (supervisor_id, child_id, relationship_type) VALUES (?, ?, ?)"
    ).bind(supervisorId, childId, type).run();
}

export async function getLinkedChildren(db, supervisorId) {
    return db.prepare(`
        SELECT 
            u.id, 
            u.username, 
            u.created_at,
            ucs.total_stars,
            ucs.energy_level,
            ucs.last_activity_date
        FROM user_links ul
        JOIN users u ON ul.child_id = u.id
        LEFT JOIN user_current_state ucs ON u.id = ucs.user_id
        WHERE ul.supervisor_id = ?
    `).bind(supervisorId).all();
}

export async function unlinkUser(db, { supervisorId, childId }) {
    return db.prepare(
        "DELETE FROM user_links WHERE supervisor_id = ? AND child_id = ?"
    ).bind(supervisorId, childId).run();
}
