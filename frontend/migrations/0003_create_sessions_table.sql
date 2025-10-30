PRAGMA defer_foreign_keys=TRUE;
CREATE TABLE demo_leads (id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT, email TEXT, org TEXT, rol TEXT, created_at TEXT DEFAULT (datetime('now')));
INSERT INTO "demo_leads" VALUES(1,'asier','agomezlopez@student.ie.edu','fre','aaa','2025-10-26 11:09:50');
INSERT INTO "demo_leads" VALUES(2,'asier','agomezlopez@student.ie.edu','fre','aaa','2025-10-26 11:09:50');
INSERT INTO "demo_leads" VALUES(3,'asier','agomezlopez@student.ie.edu','fre','aaa','2025-10-26 11:09:50');
INSERT INTO "demo_leads" VALUES(4,'asier','agomezlopez@student.ie.edu','fre','aaa','2025-10-26 11:15:39');
INSERT INTO "demo_leads" VALUES(5,'asier','agomezlopez@student.ie.edu','fre','aaa','2025-10-26 11:19:01');
INSERT INTO "demo_leads" VALUES(6,'asier','asiergomez2003@gmail.com','fre','aaa','2025-10-26 11:19:34');
INSERT INTO "demo_leads" VALUES(7,'Ana','ana.rozas@student.ie.edu','IE','a','2025-10-27 10:18:09');
CREATE TABLE d1_migrations(
                              id         INTEGER PRIMARY KEY AUTOINCREMENT,
                              name       TEXT UNIQUE,
                              applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);
INSERT INTO "d1_migrations" VALUES(1,'0001_users_secure.sql','2025-10-27 20:22:06');
INSERT INTO "d1_migrations" VALUES(2,'0002_seed_admin_user.sql','2025-10-27 20:22:06');
CREATE TABLE user_roles (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            role_name TEXT NOT NULL UNIQUE
);
INSERT INTO "user_roles" VALUES(1,'admin');
INSERT INTO "user_roles" VALUES(2,'parent');
INSERT INTO "user_roles" VALUES(3,'child');
INSERT INTO "user_roles" VALUES(4,'medical');
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
INSERT INTO "users" VALUES(1,'admin','XtMct1ezRn0//uhO90BxEvJKEGMMy7m7y9uck+9WL/w=','MZhMLe2EyJPrYTDhdc/1VQ==',100000,'pbkdf2-sha256','2025-10-27 20:22:06',2);
INSERT INTO "users" VALUES(2,'asier','/ZMTtc2Wq+WHJY4ejVZPQYwxLTurz+McwqJMQiCkRWc=','v0N+CsDre+C9kJhvPK7Y0Q==',100000,'pbkdf2-sha256','2025-10-28 08:49:26',2);
CREATE TABLE IF NOT EXISTS "sessions" (
                                          id       INTEGER PRIMARY KEY AUTOINCREMENT,
                                          id_user  INTEGER NOT NULL,
                                          log_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                                          FOREIGN KEY (id_user) REFERENCES users(id)
    ON UPDATE CASCADE
    ON DELETE CASCADE
    );
DELETE FROM sqlite_sequence;
INSERT INTO "sqlite_sequence" VALUES('demo_leads',7);
INSERT INTO "sqlite_sequence" VALUES('d1_migrations',2);
INSERT INTO "sqlite_sequence" VALUES('user_roles',16);
INSERT INTO "sqlite_sequence" VALUES('users',2);
INSERT INTO "sqlite_sequence" VALUES('sessions',0);
CREATE INDEX idx_users_role_id ON users(role_id);
CREATE INDEX idx_sessions_id_user ON sessions(id_user);
