-- Recreate users table with salted password hashes.
DROP TABLE IF EXISTS users;
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    password_iterations INTEGER NOT NULL,
    password_algo TEXT NOT NULL DEFAULT 'pbkdf2-sha256',
    created_at TEXT DEFAULT (datetime('now'))
);
