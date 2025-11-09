# Script PowerShell para aplicar migraciones en Windows

Write-Host "🔄 Aplicando migración de evaluación inicial..." -ForegroundColor Cyan

# Aplicar migración en entorno local
wrangler d1 execute eduplay-db --local --file=.\migrations\0004_create_initial_assessment.sql

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Migración aplicada correctamente en entorno local" -ForegroundColor Green
} else {
    Write-Host "❌ Error al aplicar migración en entorno local" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Para aplicar en producción, ejecuta:" -ForegroundColor Yellow
Write-Host "wrangler d1 execute eduplay-db --remote --file=.\migrations\0004_create_initial_assessment.sql" -ForegroundColor White
# Sistema de Evaluación Inicial

## Descripción General

Sistema completo de evaluación inicial para niños que se registran en la plataforma. Consta de 4 pruebas que evalúan diferentes competencias y generan un perfil personalizado del estudiante.

## Pruebas de Evaluación

### 1. Lectura en Voz Alta 📖
**Objetivo**: Evaluar la fluidez y precisión lectora del niño.

**Proceso**:
- El niño lee un texto predefinido en voz alta
- Se graba el audio usando el micrófono del navegador
- El audio se transcribe usando Whisper (servicio local de IA)
- Se compara la transcripción con el texto esperado

**Métricas Calculadas**:
- **PCPM** (Palabras Correctas Por Minuto): `(palabras_correctas / segundos) * 60`
- **Precisión**: `(palabras_correctas / palabras_totales) * 100`
- **Errores**: Diferencia entre palabras esperadas y correctas

**Datos almacenados en DB**:
```sql
assessment_reading:
- reading_text: Texto que debía leer
- audio_recording: Audio en base64
- transcription: Texto transcrito por IA
- duration_seconds: Duración de la lectura
- words_read: Palabras leídas correctamente
- words_expected: Palabras totales esperadas
- pcpm: Palabras Correctas Por Minuto
- accuracy_percentage: Porcentaje de aciertos
- errors_count: Número de errores
```

### 2. Conciencia Fonológica 🔤
**Objetivo**: Evaluar la capacidad del niño para reconocer y manipular sonidos del lenguaje.

**Proceso**:
- 5 preguntas de opción múltiple
- Tipos de preguntas:
  - Identificación de rimas
  - Conteo de sílabas
  - Identificación de fonemas

**Métricas Calculadas**:
- **% de Aciertos**: `(respuestas_correctas / total_preguntas) * 100`

**Datos almacenados en DB**:
```sql
assessment_phonological:
- test_type: Tipo de prueba ('mixto', 'rima', 'silaba', 'fonema')
- questions_data: JSON con preguntas y respuestas
- correct_answers: Número de respuestas correctas
- total_questions: Total de preguntas
- accuracy_percentage: Porcentaje de aciertos
- time_seconds: Tiempo empleado
```

### 3. Cálculo Básico 🔢
**Objetivo**: Evaluar competencia matemática básica (sumas y restas).

**Proceso**:
- 8 operaciones matemáticas simples
- El niño escribe la respuesta numérica
- Se mide el tiempo total

**Métricas Calculadas**:
- **EPM** (Ejercicios Por Minuto): `(ejercicios_correctos / segundos) * 60`
- **% de Aciertos**: `(respuestas_correctas / total_ejercicios) * 100`

**Datos almacenados en DB**:
```sql
assessment_math:
- difficulty_level: Nivel de dificultad ('basico', 'intermedio')
- questions_data: JSON con operaciones y respuestas
- correct_answers: Número de respuestas correctas
- total_questions: Total de ejercicios
- accuracy_percentage: Porcentaje de aciertos
- epm: Ejercicios Por Minuto
- time_seconds: Tiempo empleado
```

### 4. Dictado ✍️
**Objetivo**: Evaluar ortografía y escritura.

**Proceso**:
- Se reproduce un audio con texto dictado (TTS)
- El niño escribe lo que escucha
- Se compara palabra por palabra
- Se calcula distancia de Levenshtein para errores ortográficos

**Métricas Calculadas**:
- **% de Aciertos**: `(palabras_correctas / palabras_totales) * 100`
- **Errores Ortográficos**: Palabras con pequeñas diferencias
- **Errores Gramaticales**: Palabras faltantes o muy diferentes

**Datos almacenados en DB**:
```sql
assessment_dictation:
- dictation_text: Texto dictado
- audio_dictation: Audio del dictado (opcional)
- student_response: Lo que escribió el niño
- words_total: Total de palabras
- words_correct: Palabras escritas correctamente
- accuracy_percentage: Porcentaje de aciertos
- spelling_errors: Errores ortográficos
- grammar_errors: Errores gramaticales
```

## Perfil del Estudiante

Después de completar las 4 pruebas, se genera automáticamente un perfil del estudiante:

**Niveles calculados** (inicial, básico, intermedio, avanzado):
- **Nivel de Lectura**: Basado en PCPM y precisión
  - Avanzado: PCPM ≥ 100
  - Intermedio: PCPM ≥ 60
  - Básico: PCPM ≥ 30
  - Inicial: PCPM < 30

- **Nivel Fonológico**: Basado en % aciertos
  - Avanzado: ≥ 85%
  - Intermedio: ≥ 70%
  - Básico: ≥ 50%
  - Inicial: < 50%

- **Nivel Matemático**: Basado en % aciertos y EPM
  - Avanzado: ≥ 90% y EPM ≥ 8
  - Intermedio: ≥ 75% y EPM ≥ 5
  - Básico: ≥ 60%
  - Inicial: < 60%

- **Nivel de Escritura**: Basado en % aciertos
  - Avanzado: ≥ 90%
  - Intermedio: ≥ 75%
  - Básico: ≥ 60%
  - Inicial: < 60%

**Métricas Globales**:
- `overall_pcpm`: PCPM de la prueba de lectura
- `overall_epm`: EPM de la prueba de matemáticas
- `overall_accuracy`: Promedio de todas las precisiones

**Análisis Generado**:
- `strengths`: Array de fortalezas detectadas
- `areas_improvement`: Array de áreas a mejorar
- `recommended_activities`: Array de actividades recomendadas

## Estructura de Base de Datos

### Tabla: initial_assessments
Tabla principal que registra cada evaluación.

```sql
CREATE TABLE initial_assessments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    assessment_date TEXT NOT NULL DEFAULT (datetime('now')),
    completed BOOLEAN NOT NULL DEFAULT 0,
    overall_score REAL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### Tabla: student_profiles
Perfil calculado basado en la evaluación.

```sql
CREATE TABLE student_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    assessment_id INTEGER,
    reading_level TEXT,
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
```

## API Endpoints

### POST /api/assessment
Crear nueva evaluación.

**Respuesta**:
```json
{
  "ok": true,
  "assessmentId": 123
}
```

### GET /api/assessment?id={assessmentId}
Obtener detalles de una evaluación específica.

### POST /api/assessment-reading
Guardar resultado de prueba de lectura.

**Body**:
```json
{
  "assessmentId": 123,
  "readingText": "...",
  "audioRecording": "base64...",
  "transcription": "...",
  "durationSeconds": 45.5,
  "wordsRead": 42,
  "wordsExpected": 45
}
```

### POST /api/assessment-phonological
Guardar resultado de conciencia fonológica.

### POST /api/assessment-math
Guardar resultado de cálculo básico.

### POST /api/assessment-dictation
Guardar resultado de dictado.

### POST /api/student-profile
Generar perfil del estudiante basado en evaluación.

**Body**:
```json
{
  "assessmentId": 123
}
```

### GET /api/student-profile
Obtener perfil actual del estudiante.

## Integración con Servicios de IA

### Servicio de Audio (Puerto 8001)
- **Transcripción**: POST `/transcribe`
  - Convierte audio a texto usando Whisper
- **TTS**: POST `/tts`
  - Genera audio del dictado

**Nota**: Si los servicios no están disponibles, el sistema usa datos simulados para no bloquear el flujo.

## Flujo de Uso

1. Niño se registra en la plataforma
2. Después del registro, se redirige a `/assessment.html`
3. Completa las 4 pruebas en orden
4. Sistema calcula métricas automáticamente
5. Se genera perfil del estudiante
6. Se redirige a la aplicación principal con perfil personalizado

## Instalación y Configuración

### 1. Ejecutar migraciones de base de datos

```bash
# Desde el directorio frontend
wrangler d1 execute eduplay-db --local --file=./migrations/0004_create_initial_assessment.sql
```

### 2. Iniciar servicios de IA (opcional)

```bash
# Servicio de audio
cd ai-services-local/audio_service
python app.py

# Escucha en http://localhost:8001
```

### 3. Acceder a la evaluación

```
http://localhost:8787/assessment.html
```

## Personalización

### Modificar textos de evaluación
Editar `frontend/scripts/assessment.js`:
- `READING_TEXT`: Texto para lectura
- `PHONOLOGICAL_QUESTIONS`: Preguntas de fonología
- `MATH_QUESTIONS`: Operaciones matemáticas
- `DICTATION_TEXT`: Texto para dictado

### Ajustar criterios de nivel
Editar `frontend/functions/api/student-profile.js`:
- Función `calculateStudentProfile()`
- Cambiar umbrales de PCPM, EPM, y porcentajes

## Métricas Clave

### PCPM (Palabras Correctas Por Minuto)
Mide la fluidez lectora. Valores de referencia:
- < 30: Lectura muy lenta
- 30-60: Lectura básica
- 60-100: Lectura fluida
- > 100: Lectura avanzada

### EPM (Ejercicios Por Minuto)
Mide velocidad en cálculo mental. Valores de referencia:
- < 3: Cálculo lento
- 3-5: Cálculo básico
- 5-8: Cálculo normal
- > 8: Cálculo rápido

### % de Aciertos
Mide precisión en todas las pruebas:
- < 60%: Necesita refuerzo
- 60-75%: Nivel básico
- 75-90%: Buen nivel
- > 90%: Excelente nivel

## Próximas Mejoras

- [ ] Dashboard para padres/tutores
- [ ] Gráficas de progreso en el tiempo
- [ ] Comparación con promedios por edad
- [ ] Exportar informes en PDF
- [ ] Evaluaciones periódicas automáticas
- [ ] Recomendaciones de actividades más específicas
- [ ] Integración con sistema de logros/gamificación

