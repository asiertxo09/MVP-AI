-- Migration: 0007_gamification
-- Add tables for gamification: achievements, streaks, activity tracking, and map progress

-- 1. Achievements Definition (Badges)
CREATE TABLE IF NOT EXISTS achievements (
    id TEXT PRIMARY KEY, -- e.g., 'reading_star_1'
    title TEXT NOT NULL,
    description TEXT,
    icon_url TEXT NOT NULL,
    criteria TEXT NOT NULL -- JSON or text description of how to unlock
);

-- 2. User Achievements (Unlocked Badges)
CREATE TABLE IF NOT EXISTS user_achievements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    achievement_id TEXT NOT NULL,
    unlocked_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (achievement_id) REFERENCES achievements(id) ON DELETE CASCADE,
    UNIQUE(user_id, achievement_id)
);

-- 3. User Streaks (Daily Logic)
CREATE TABLE IF NOT EXISTS user_streaks (
    user_id INTEGER PRIMARY KEY,
    last_login_date TEXT, -- YYYY-MM-DD
    current_streak INTEGER DEFAULT 0,
    max_streak INTEGER DEFAULT 0,
    total_logins INTEGER DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 4. Activity Log (Clinical Metrics: PCMP, EPM, Reaction Time)
CREATE TABLE IF NOT EXISTS activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    activity_type TEXT NOT NULL, -- 'phoneme_hunt', 'reading', 'assessment'
    score INTEGER, -- Generic score
    duration_seconds INTEGER,
    
    -- Clinical Metrics (optional, can be null if not applicable)
    metric_pcmp REAL, -- Palabras Correctas por Minuto
    metric_epm REAL, -- Errores por Minuto
    metric_reaction_time_ms INTEGER, -- Reaction time in milliseconds
    
    metadata TEXT, -- JSON for extra details (e.g., specific phonemes practiced)
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 5. Student Progress (The Map)
CREATE TABLE IF NOT EXISTS student_progress (
    user_id INTEGER PRIMARY KEY,
    current_level INTEGER DEFAULT 1, -- The overall level/world
    current_node_index INTEGER DEFAULT 0, -- Position on the map (0-based)
    stars_total INTEGER DEFAULT 0,
    coins_total INTEGER DEFAULT 0,
    
    -- Using a simple JSON text field to store the state of each node if needed
    -- (e.g., {"node_0": "done", "node_1": "unlocked"})
    -- or just rely on current_node_index to determine what's unlocked.
    nodes_state TEXT DEFAULT '{}', 
    
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON user_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_user ON activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_type ON activity_log(activity_type);
