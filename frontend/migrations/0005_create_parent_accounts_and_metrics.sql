a-- Migration: 0005_create_parent_accounts_and_metrics
-- Crea la estructura para cuentas de padres y métricas de juegos

-- Tabla para almacenar las contraseñas de padres asociadas a cuentas de niños
CREATE TABLE IF NOT EXISTS parent_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    child_user_id INTEGER NOT NULL,
    parent_password_hash TEXT NOT NULL,
    parent_password_salt TEXT NOT NULL,
    parent_password_iterations INTEGER NOT NULL DEFAULT 100000,
    parent_password_algo TEXT NOT NULL DEFAULT 'pbkdf2-sha256',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_access TEXT,
    FOREIGN KEY (child_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_parent_child ON parent_accounts(child_user_id);

-- Tabla para métricas de actividades/juegos en tiempo real
CREATE TABLE IF NOT EXISTS activity_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    activity_type TEXT NOT NULL, -- 'math', 'write', 'speak', 'lenguaje', 'sensorial', 'matematicas'
    activity_name TEXT NOT NULL,
    completed_at TEXT NOT NULL DEFAULT (datetime('now')),
    duration_seconds REAL,
    stars_earned INTEGER DEFAULT 0,
    energy_change INTEGER DEFAULT 0,
    is_correct BOOLEAN,
    difficulty_level TEXT, -- 'basico', 'intermedio', 'avanzado'
    challenge_data TEXT, -- JSON con detalles del desafío
    user_response TEXT, -- JSON con la respuesta del usuario
    metadata TEXT, -- JSON con información adicional
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_activity_metrics_user ON activity_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_metrics_date ON activity_metrics(completed_at);
CREATE INDEX IF NOT EXISTS idx_activity_metrics_type ON activity_metrics(activity_type);

-- Tabla para métricas agregadas diarias (para optimizar consultas)
CREATE TABLE IF NOT EXISTS daily_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    metric_date TEXT NOT NULL, -- Formato: YYYY-MM-DD
    total_activities INTEGER DEFAULT 0,
    total_stars INTEGER DEFAULT 0,
    avg_energy_level REAL DEFAULT 5.0,
    activities_by_type TEXT, -- JSON: {"math": 5, "write": 3, ...}
    accuracy_percentage REAL,
    total_time_seconds REAL DEFAULT 0,
    streak_days INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_metrics_user_date ON daily_metrics(user_id, metric_date);
CREATE INDEX IF NOT EXISTS idx_daily_metrics_date ON daily_metrics(metric_date);

-- Tabla para el estado actual de cada niño (snapshot rápido)
CREATE TABLE IF NOT EXISTS user_current_state (
    user_id INTEGER PRIMARY KEY,
    total_stars INTEGER DEFAULT 0,
    energy_level REAL DEFAULT 5.0,
    current_streak INTEGER DEFAULT 0,
    last_activity_date TEXT,
    last_activity_type TEXT,
    total_activities_completed INTEGER DEFAULT 0,
    total_time_played_seconds REAL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Vista para métricas consolidadas (evaluación inicial + juegos)
CREATE VIEW IF NOT EXISTS student_complete_metrics AS
SELECT
    u.id as user_id,
    u.username,
    u.created_at as user_created_at,

    -- Estado actual
    ucs.total_stars,
    ucs.energy_level,
    ucs.current_streak,
    ucs.last_activity_date,
    ucs.total_activities_completed,
    ucs.total_time_played_seconds,

    -- Evaluación inicial
    ia.id as assessment_id,
    ia.completed as assessment_completed,
    ia.overall_score as assessment_score,
    ia.assessment_date,

    -- Perfil del estudiante
    sp.reading_level,
    sp.phonological_level,
    sp.math_level,
    sp.writing_level,
    sp.overall_pcpm,
    sp.overall_epm,
    sp.overall_accuracy,
    sp.strengths,
    sp.areas_improvement

FROM users u
LEFT JOIN user_current_state ucs ON u.id = ucs.user_id
LEFT JOIN initial_assessments ia ON u.id = ia.user_id AND ia.completed = 1
LEFT JOIN student_profiles sp ON u.id = sp.user_id
WHERE u.role_id = 3; -- Solo niños

