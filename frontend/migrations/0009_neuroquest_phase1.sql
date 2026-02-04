-- Migration number: 0009 	 2024-05-22T00:00:00.000Z
-- Description: Create interaction_events and modality_profiles tables

-- Table for high-frequency interaction events (telemetry)
CREATE TABLE IF NOT EXISTS interaction_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER,
    timestamp INTEGER NOT NULL, -- Unix timestamp in milliseconds
    stimulus_id TEXT,
    interaction_type TEXT NOT NULL, -- tap_start, tap_end, drag_path, voice_onset, etc.
    reaction_time_ms INTEGER,
    execution_time_ms INTEGER,
    force_pressure REAL,
    status TEXT, -- Correct, Incorrect, Timeout
    error_class TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    -- Note: session_id is loosely coupled to sessions table, strictly enforcing FK might be expensive on high-throughput inserts if checking every time, but D1 supports standard FKs.
    -- FOREIGN KEY (session_id) REFERENCES sessions(id)
);

-- Index for querying events by session
CREATE INDEX IF NOT EXISTS idx_interaction_events_session_id ON interaction_events(session_id);

-- Table for child modality profiles (Visual, Auditory, Kinesthetic indices)
CREATE TABLE IF NOT EXISTS modality_profiles (
    child_id INTEGER PRIMARY KEY,
    visual_index REAL DEFAULT 0.0,
    auditory_index REAL DEFAULT 0.0,
    kinesthetic_index REAL DEFAULT 0.0,
    cross_modal_transfer REAL DEFAULT 0.0,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (child_id) REFERENCES children(id)
);
