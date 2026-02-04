-- Migration: 0004_create_initial_assessment
-- Crea las tablas para las evaluaciones iniciales de los niños

-- Tabla principal de evaluaciones
CREATE TABLE IF NOT EXISTS initial_assessments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    assessment_date TEXT NOT NULL DEFAULT (datetime('now')),
    completed BOOLEAN NOT NULL DEFAULT 0,
    overall_score REAL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_assessments_user_id ON initial_assessments(user_id);
CREATE INDEX IF NOT EXISTS idx_assessments_date ON initial_assessments(assessment_date);

-- Tabla para la prueba 1: Lectura en voz alta
CREATE TABLE IF NOT EXISTS assessment_reading (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    assessment_id INTEGER NOT NULL,
    reading_text TEXT NOT NULL,
    audio_recording TEXT, -- Base64 del audio
    transcription TEXT,
    duration_seconds REAL,
    words_read INTEGER,
    words_expected INTEGER,
    pcpm REAL, -- Palabras Correctas Por Minuto
    accuracy_percentage REAL,
    errors_count INTEGER DEFAULT 0,
    completed_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (assessment_id) REFERENCES initial_assessments(id)
);

-- Tabla para la prueba 2: Conciencia fonológica
CREATE TABLE IF NOT EXISTS assessment_phonological (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    assessment_id INTEGER NOT NULL,
    test_type TEXT NOT NULL, -- 'rima', 'silaba', 'fonema'
    questions_data TEXT NOT NULL, -- JSON con preguntas y respuestas
    correct_answers INTEGER DEFAULT 0,
    total_questions INTEGER DEFAULT 0,
    accuracy_percentage REAL,
    time_seconds REAL,
    completed_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (assessment_id) REFERENCES initial_assessments(id)
);

-- Tabla para la prueba 3: Cálculo básico
CREATE TABLE IF NOT EXISTS assessment_math (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    assessment_id INTEGER NOT NULL,
    difficulty_level TEXT NOT NULL, -- 'basico', 'intermedio'
    questions_data TEXT NOT NULL, -- JSON con operaciones y respuestas
    correct_answers INTEGER DEFAULT 0,
    total_questions INTEGER DEFAULT 0,
    accuracy_percentage REAL,
    epm REAL, -- Ejercicios Por Minuto
    time_seconds REAL,
    completed_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (assessment_id) REFERENCES initial_assessments(id)
);

-- Tabla para la prueba 4: Dictado
CREATE TABLE IF NOT EXISTS assessment_dictation (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    assessment_id INTEGER NOT NULL,
    dictation_text TEXT NOT NULL, -- Texto que se dicta
    audio_dictation TEXT, -- Audio del dictado (opcional)
    student_response TEXT NOT NULL, -- Lo que escribió el niño
    words_total INTEGER,
    words_correct INTEGER,
    accuracy_percentage REAL,
    spelling_errors INTEGER DEFAULT 0,
    grammar_errors INTEGER DEFAULT 0,
    completed_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (assessment_id) REFERENCES initial_assessments(id)
);

-- Tabla para métricas calculadas y perfil del niño
CREATE TABLE IF NOT EXISTS student_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    assessment_id INTEGER,
    reading_level TEXT, -- 'inicial', 'basico', 'intermedio', 'avanzado'
    phonological_level TEXT,
    math_level TEXT,
    writing_level TEXT,
    overall_pcpm REAL,
    overall_epm REAL,
    overall_accuracy REAL,
    strengths TEXT, -- JSON array
    areas_improvement TEXT, -- JSON array
    recommended_activities TEXT, -- JSON array
    last_updated TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (assessment_id) REFERENCES initial_assessments(id)
);

CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON student_profiles(user_id);

