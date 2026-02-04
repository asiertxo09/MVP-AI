PRAGMA defer_foreign_keys=TRUE;
CREATE TABLE IF NOT EXISTS demo_leads (id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT, email TEXT, org TEXT, rol TEXT, created_at TEXT DEFAULT (datetime('now')));
INSERT OR IGNORE INTO "demo_leads" VALUES(1,'asier','agomezlopez@student.ie.edu','fre','aaa','2025-10-26 11:09:50');
INSERT OR IGNORE INTO "demo_leads" VALUES(2,'asier','agomezlopez@student.ie.edu','fre','aaa','2025-10-26 11:09:50');
INSERT OR IGNORE INTO "demo_leads" VALUES(3,'asier','agomezlopez@student.ie.edu','fre','aaa','2025-10-26 11:09:50');
INSERT OR IGNORE INTO "demo_leads" VALUES(4,'asier','agomezlopez@student.ie.edu','fre','aaa','2025-10-26 11:15:39');
INSERT OR IGNORE INTO "demo_leads" VALUES(5,'asier','agomezlopez@student.ie.edu','fre','aaa','2025-10-26 11:19:01');
INSERT OR IGNORE INTO "demo_leads" VALUES(6,'asier','asiergomez2003@gmail.com','fre','aaa','2025-10-26 11:19:34');
INSERT OR IGNORE INTO "demo_leads" VALUES(7,'Ana','ana.rozas@student.ie.edu','IE','a','2025-10-27 10:18:09');

/* Removing d1_migrations manual insert heavily discouraged */

CREATE TABLE IF NOT EXISTS user_roles (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            role_name TEXT NOT NULL UNIQUE
);
INSERT OR IGNORE INTO "user_roles" VALUES(1,'admin');
INSERT OR IGNORE INTO "user_roles" VALUES(2,'parent');
INSERT OR IGNORE INTO "user_roles" VALUES(3,'child');
INSERT OR IGNORE INTO "user_roles" VALUES(4,'medical');
CREATE TABLE IF NOT EXISTS "users" (
                                       id             INTEGER PRIMARY KEY AUTOINCREMENT,
                                       username       TEXT NOT NULL UNIQUE,
                                       password_hash  TEXT NOT NULL,
                                       password_salt  TEXT NOT NULL,
                                       password_iterations  INTEGER,
                                       password_algo  TEXT,
                                       created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
                                       role_id        INTEGER NOT NULL,
                                       FOREIGN KEY (role_id) REFERENCES user_roles(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
    );
/* Removing user inserts to avoid conflict with existing users or 0001 */

CREATE TABLE IF NOT EXISTS "sessions" (
                                          id       INTEGER PRIMARY KEY AUTOINCREMENT,
                                          id_user  INTEGER NOT NULL,
                                          log_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                                          FOREIGN KEY (id_user) REFERENCES users(id)
    ON UPDATE CASCADE
    ON DELETE CASCADE
    );

INSERT INTO "sqlite_sequence" VALUES('demo_leads',7);
INSERT INTO "sqlite_sequence" VALUES('d1_migrations',2);
INSERT INTO "sqlite_sequence" VALUES('user_roles',16);
INSERT INTO "sqlite_sequence" VALUES('users',2);
INSERT INTO "sqlite_sequence" VALUES('sessions',0);
CREATE INDEX IF NOT EXISTS idx_users_role_id ON users(role_id);
CREATE INDEX IF NOT EXISTS idx_sessions_id_user ON sessions(id_user);
