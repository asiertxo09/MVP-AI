# 🚀 Guía Rápida: Sistema de Evaluación Inicial

## Instalación en 3 Pasos

### 1️⃣ Aplicar Migración de Base de Datos

**En Linux/Mac:**
```bash
cd frontend
chmod +x scripts/migrate-assessment.sh
./scripts/migrate-assessment.sh
```

**En Windows (PowerShell):**
```powershell
cd frontend
.\scripts\migrate-assessment.ps1
```

**O manualmente:**
```bash
wrangler d1 execute DB --local --file=./migrations/0004_create_initial_assessment.sql
```

### 2️⃣ Iniciar Servicios de IA (Opcional pero Recomendado)

```bash
# Terminal 1: Servicio de Audio (Whisper + TTS)
cd ai-services-local/audio_service
pip install -r requirements.txt
python app.py
# Escucha en http://localhost:8001
```

**Nota**: Si no inicias estos servicios, el sistema funcionará con datos simulados.

### 3️⃣ Iniciar la Aplicación

```bash
cd frontend
npm run dev
# O
wrangler pages dev
```

## 🎯 Uso

1. Accede a: `http://localhost:8787/assessment.html`
2. Completa las 4 pruebas:
   - 📖 Lectura en voz alta
   - 🔤 Conciencia fonológica
   - 🔢 Cálculo básico
   - ✍️ Dictado
3. ¡Obtén tu perfil personalizado!

## 📊 Métricas Calculadas

- **PCPM**: Palabras Correctas Por Minuto
- **EPM**: Ejercicios Por Minuto
- **% Aciertos**: Precisión general

## 🗄️ Tablas Creadas

- `initial_assessments` - Registro de evaluaciones
- `assessment_reading` - Prueba de lectura
- `assessment_phonological` - Conciencia fonológica
- `assessment_math` - Cálculo básico
- `assessment_dictation` - Dictado
- `student_profiles` - Perfil del estudiante

## 🔗 API Endpoints Disponibles

- `POST /api/assessment` - Crear evaluación
- `POST /api/assessment-reading` - Guardar lectura
- `POST /api/assessment-phonological` - Guardar fonología
- `POST /api/assessment-math` - Guardar matemáticas
- `POST /api/assessment-dictation` - Guardar dictado
- `POST /api/student-profile` - Generar perfil
- `GET /api/student-profile` - Obtener perfil

## 📖 Documentación Completa

Ver `docs/EVALUACION_INICIAL.md` para detalles completos.

## ⚠️ Requisitos

- Node.js 18+
- Wrangler CLI
- Python 3.8+ (para servicios de IA)
- Micrófono (para prueba de lectura)

## 🐛 Solución de Problemas

### Error: "Missing database binding"
```bash
# Verificar configuración en wrangler.toml
[[d1_databases]]
binding = "DB"
database_name = "eduplay-db"
database_id = "..."
```

### Audio no se graba
- Asegúrate de dar permisos al navegador para usar el micrófono
- Usa HTTPS o localhost

### Servicio de transcripción no funciona
- El sistema funciona sin servicios de IA usando simulación
- Para activarlo, inicia `audio_service` en puerto 8001

