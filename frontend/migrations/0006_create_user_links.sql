-- Migration: 0006_create_user_links
-- Create table for linking accounts (Parent-Child, Specialist-Child)

CREATE TABLE IF NOT EXISTS user_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supervisor_id INTEGER NOT NULL, -- Parent or Doc
    child_id INTEGER NOT NULL, -- Child
    relationship_type TEXT NOT NULL, -- 'parent', 'specialist'
    status TEXT NOT NULL DEFAULT 'active', -- 'pending', 'active'
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (supervisor_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (child_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(supervisor_id, child_id)
);

CREATE INDEX IF NOT EXISTS idx_user_links_supervisor ON user_links(supervisor_id);
CREATE INDEX IF NOT EXISTS idx_user_links_child ON user_links(child_id);
