# README_DEV_Codex.md — EduPlay MVP (v1.0)

## 0. Alcance y propósito

Este documento es una guía técnica, detallada y autosuficiente para que un equipo de desarrollo implemente y despliegue el MVP de EduPlay como web app responsive sobre Cloudflare Pages + Functions (D1/SQLite), con un backend IA en Node.js y un servicio local en Python para modelos de Hugging Face (imágenes, audio, STT/TTS) ejecutándose en el servidor sin claves API.  
El backend de texto usa Grok API (en español). La guía toma como base lo ya desarrollado en tu repositorio MVP-AI y consolida la especificación del MVP con estructura de carpetas, endpoints, seguridad, datos y diseño de pantallas.

Referencia del repositorio existente: la arquitectura actual incluye `frontend/` (Cloudflare Pages + Functions, D1), `ai-backend-groq/` (Node/Express con Grok y Hugging Face) y un servicio Python para imágenes (SDXL), con rutas y endpoints ya descritos en el README y `server.js` del backend IA.

---

## 1. Arquitectura técnica

### 1.1 Diagrama lógico

```
Navegador (Web App Responsive)
   └─ Cloudflare Pages + Functions (D1/SQLite)
       ├─ /api/register | /api/login | /api/logout | /api/demo
       ├─ /app/* (UI infantil y panel profesional) [protegidas por cookie de sesión]
       └─▶ AI Backend (Node.js 18+)
             ├─ POST /api/generate     → Grok (texto, español)
             ├─ POST /api/transcribe   → HF local (ASR / Speech-to-Text)
             └─ POST /api/image        → SDXL local (difusión de imágenes)
```

### 1.2 Decisiones clave

- Frontend: Cloudflare Pages + Functions (Workers), DB Cloudflare D1 (SQLite).  
- Backend IA (Node): Express 5, rate-limiting, CORS restringido, validación con Zod, Grok API para texto. Endpoints `/api/generate`, `/api/transcribe`, `/api/image`.  
- Servicio Python local: FastAPI o Flask para SDXL (imágenes) y pipelines de HF (ASR/TTS) sin claves.  
- Autenticación: registro/login en Functions, cookies firmadas HMAC, contraseñas PBKDF2 con SHA-256 (~100k iteraciones).

---

## 2. Estructura de carpetas (monorepo)

> Crea/ajusta la siguiente estructura en la raíz del proyecto.

```
/eduplay-mvp/
├── frontend/                          # Cloudflare Pages + Functions
│   ├── public/
│   │   ├── index.html                 # Landing/portada
│   │   ├── login.html                 # Pantalla de acceso
│   │   ├── register.html              # Alta y consentimiento
│   │   ├── app-child.html             # UI infantil (juegos)
│   │   ├── app-professional.html      # Panel profesional
│   │   ├── settings.html              # Accesibilidad y privacidad
│   │   └── assets/
│   │       ├── logo/                  # Logo oficial EduPlay
│   │       ├── icons/
│   │       ├── images/
│   │       └── audio/
│   ├── styles/
│   │   ├── variables.css              # Paleta y tokens de diseño
│   │   ├── base.css
│   │   ├── app-child.css
│   │   ├── app-professional.css
│   │   └── responsive.css
│   ├── scripts/
│   │   ├── auth.js
│   │   ├── child-app.js               # Lógica de juegos (UI)
│   │   ├── professional-app.js        # Panel (KPIs, informes)
│   │   ├── settings.js
│   │   └── api-client.js              # Cliente HTTP a Functions/AI backend
│   ├── functions/
│   │   └── api/
│   │       ├── register.js            # POST /api/register
│   │       ├── login.js               # POST /api/login
│   │       ├── logout.js              # POST /api/logout
│   │       ├── demo.js                # POST /api/demo (opcional)
│   │       └── _middleware.js         # Protección de rutas /app/* por sesión
│   ├── migrations/
│   │   ├── 0001_init.sql              # users, sessions, roles, profiles
│   │   ├── 0002_progress.sql          # métricas por sesión
│   │   └── 0003_content.sql           # catálogos, ajustes
│   ├── wrangler.toml
│   └── package.json
│
├── ai-backend-groq/                   # Backend IA (Node.js + Grok + HF local)
│   ├── server.js                      # Express + endpoints IA
│   ├── package.json
│   ├── .env.example                   # Variables (ver sección 4)
│   └── README.md
│
├── ai-services-local/                 # Servicios Python locales (HF)
│   ├── sdxl_service/
│   │   ├── app.py                     # POST /image (SDXL → PNG)
│   │   ├── models/                    # Pesos locales (si aplica)
│   │   └── requirements.txt
│   ├── audio_service/
│   │   ├── app.py                     # ASR/TTS (STT/TTS locales)
│   │   ├── requirements.txt
│   │   └── models/
│   └── docker/                        # Opcional: docker-compose.yml
│
└── docs/
    ├── SECURITY.md
    ├── ACCESSIBILITY.md
    └── DATA_MODEL.md
```

---

## 3. Requisitos y versiones

- Node.js 18+
- npm
- Python 3.10+
- Cloudflare: cuenta activa y D1 (SQLite)
- FFmpeg (para audio, TTS/STT locales)
- CPU con AVX2 recomendable; GPU opcional para SDXL si está disponible

---

## 4. Configuración de entorno

### 4.1 Cloudflare (frontend)

`wrangler.toml` (ejemplo mínimo):

```toml
name = "eduplay-frontend"
main = "functions/api/_middleware.js"
compatibility_date = "2024-05-01"

[vars]
SESSION_SECRET = "cambia_esto_por_uno_de_32+_caracteres"

[[d1_databases]]
binding = "DB"
database_name = "eduplay_db"
database_id = "REEMPLAZA_POR_ID"
```

### 4.2 Backend IA (Node.js)

Crea `.env` a partir de `.env.example`:

```
# Grok (texto)
GROQ_API_KEY=<tu_clave_grok>

# Uso exclusivo local de HF (sin tokens HF):
LOCAL_SDXL_URL=http://127.0.0.1:5005/image
LOCAL_ASR_URL=http://127.0.0.1:5006/transcribe
LOCAL_TTS_URL=http://127.0.0.1:5006/tts

PORT=3001
CORS_ORIGIN=https://tu-dominio.pages.dev
```

### 4.3 Servicios locales (Python)

- `ai-services-local/sdxl_service/requirements.txt`:
  ```
  fastapi
  uvicorn[standard]
  pillow
  torch
  torchvision
  diffusers
  transformers
  accelerate
  safetensors
  ```
- `ai-services-local/audio_service/requirements.txt`:
  ```
  fastapi
  uvicorn[standard]
  numpy
  torch
  torchaudio
  transformers
  accelerate
  safetensors
  ffmpeg-python
  soundfile
  ```

---

## 5. Arranque y despliegue

### 5.1 Desarrollo local

```bash
# 1) Frontend (Cloudflare Pages + Functions)
cd frontend
npm install
npm run dev    # arranca wrangler pages dev (con Functions)
```

```bash
# 2) Backend IA (Node.js)
cd ../ai-backend-groq
npm install
cp .env.example .env
npm run dev    # o: node server.js
npm test        # pruebas de integración (Vitest)
```

```bash
# 3) Servicios locales (Python)
# 3.a) Imágenes (SDXL)
cd ../ai-services-local/sdxl_service
pip install -r requirements.txt
uvicorn app:app --host 0.0.0.0 --port 5005

# 3.b) Audio (ASR/TTS)
cd ../audio_service
pip install -r requirements.txt
uvicorn app:app --host 0.0.0.0 --port 5006
```

Asegúrate de que `LOCAL_SDXL_URL`, `LOCAL_ASR_URL` y `LOCAL_TTS_URL` apunten a los puertos anteriores.

> Los tres servicios (Node y Python) exponen `/health`, `/health/live` y `/health/ready` como checks de vida y preparación.

### 5.2 Migraciones D1 (Cloudflare)

```bash
# Inicial
wrangler d1 migrations apply DB --local

# Verifica esquema
wrangler d1 execute DB --local --command "PRAGMA table_info(users);"

# Despliegue remoto (cuando corresponda)
wrangler d1 migrations apply DB --remote
```

---

## 6. Base de datos (D1/SQLite)

### 6.1 Tablas mínimas del MVP

- `users`  
  - `id` INTEGER PK  
  - `username` TEXT UNIQUE NOT NULL  
  - `password_hash` TEXT NOT NULL  
  - `password_salt` TEXT NOT NULL  
  - `password_iterations` INTEGER NOT NULL DEFAULT 100000  
  - `password_algo` TEXT NOT NULL DEFAULT 'PBKDF2-SHA256'  
  - `role` TEXT CHECK(role IN ('child','family','professional','admin')) NOT NULL  
  - `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP

- `profiles_child`  
  - `user_id` INTEGER UNIQUE REFERENCES users(id)  
  - `tutor_family_id` INTEGER REFERENCES users(id)  
  - `tutor_staff_id` INTEGER REFERENCES users(id)  
  - `consent_version` TEXT NOT NULL  
  - `consent_signed_at` DATETIME NOT NULL

- `progress_sessions`  
  - `id` INTEGER PK  
  - `user_id` INTEGER REFERENCES users(id)  
  - `module` TEXT CHECK(module IN ('fonologia','lectura','dictado','calculo_mental','calculo_escrito'))  
  - `pcpm` REAL NULL  
  - `epm` REAL NULL  
  - `accuracy_pct` REAL NULL  
  - `time_secs` INTEGER NULL  
  - `on_task_secs` INTEGER NULL  
  - `completed` INTEGER NOT NULL DEFAULT 0  
  - `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP

- `weekly_plans`  
  - `id` INTEGER PK  
  - `user_id` INTEGER REFERENCES users(id)  
  - `sessions_per_week` INTEGER NOT NULL DEFAULT 4  
  - `session_minutes` INTEGER NOT NULL DEFAULT 15  
  - `targets_json` TEXT NOT NULL         # metas por fonema/familia numérica  
  - `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP

- `kpi_rollups`  
  - `user_id` INTEGER  
  - `week_start` DATE  
  - `pcpm_avg` REAL  
  - `epm_avg` REAL  
  - `accuracy_avg` REAL  
  - `on_task_avg` REAL  
  - `compliance_pct` REAL  
  - UNIQUE(user_id, week_start)

---

## 7. Autenticación, sesiones y roles

- Register/Login/Logout: expuestos en Functions (`/api/register`, `/api/login`, `/api/logout`) con cookie de sesión firmada.  
- Protección de rutas: `_middleware.js` controla acceso a `/app/*` (redirige a `/login` si falta/expira la cookie).  
- Roles:
  - `child`: acceso a UI infantil (juegos, feedback).  
  - `family`: lectura de informes, progreso y adherencia.  
  - `professional`: panel de KPIs, asignación de tareas, exportación PDF.  
  - `admin`: gestión de usuarios, auditoría.

---

## 8. Endpoints del Backend IA (Node.js)

- `GET /health` → `{ ok: true }` (comprobación rápida).  
- `POST /api/generate` → Grok (texto español, breve, orientado a niños 5–10). Entrada `{ prompt, level? }`, salida `{ text }`.  
- `POST /api/transcribe` → ASR local (delegar a `LOCAL_ASR_URL`). Entrada `{ audio: base64 }`, salida `{ text, confidence }`.  
- `POST /api/image` → SDXL local (delegar a `LOCAL_SDXL_URL`). Entrada `{ prompt, style? }`, salida `image/png`.

Seguridad: CORS restringido, rate-limiting 60 rpm, validación Zod.

---

## 9. Servicios locales (Python, HF)

### 9.1 SDXL (imágenes)

- Endpoint: `POST /image`  
- Body: `{ "prompt": "…texto educativo…" }`  
- Respuesta: `image/png` (PNG binario)  
- Modelo: `stabilityai/stable-diffusion-xl-base-1.0` (vía diffusers)  
- Notas de rendimiento: activar `torch.cuda.is_available()` si hay GPU; en CPU, usar `torch.set_num_threads(n)` según vCPU.

### 9.2 Audio (ASR/TTS)

- ASR (STT): `facebook/wav2vec2-base-960h` o multilingüe (p. ej., `jonatasgrosman/wav2vec2-large-xlsr-53-spanish`).  
- TTS: modelos HF compatibles en español (p. ej., `coqui-ai/XTTS-v2` si es viable).  
- Endpoints:
  - `POST /transcribe` → `{ audio: base64, format?: 'wav'|'mp3' }` → `{ text, confidence }`  
  - `POST /tts` → `{ text, voice?: 'default', speed?: 1.0 }` → `audio/wav`

Requisitos: FFmpeg instalado en el host, normalización de audio a 16 kHz PCM para ASR, colas asincrónicas para concurrencia.

---

## 10. Pantallas y funcionalidades (MVP)

### 10.1 Colores de marca y tokens de diseño

> Sustituye por los HEX exactos del logo oficial en `styles/variables.css`.

```css
:root {
  --color-primary:   #000000;
  --color-secondary: #000000;
  --color-accent:    #000000;

  --color-success:   #3AD29F;
  --color-warning:   #FFC857;
  --color-error:     #E94E4E;
  --color-bg:        #F9F9F9;
  --color-text:      #111111;

  --font-ui: "Poppins", "Inter", system-ui, -apple-system, sans-serif;

  --radius-lg: 16px;
  --shadow-ui: 0 6px 24px rgba(0,0,0,0.08);
}
```

### 10.2 Login (`/login`)

- Campos: usuario/correo, contraseña.  
- Validación: cliente/servidor.  
- Acción: `POST /api/login` (cookie de sesión firmada).  
- Errores: credenciales inválidas → 401.

### 10.3 Registro (`/register`)

- Campos: nombre, correo, contraseña, consentimiento parental/LOPDGDD.  
- Acción: `POST /api/register` → `201 Created` o `409` si usuario existe.

### 10.4 UI infantil (`/app-child`)

- Módulos del MVP:
  - Fonología (Caza-fonemas).  
  - Lectura (lectura en voz alta de listas cortas).  
  - Dictado guiado (input de texto, comparación dif).  
  - Cálculo mental y escrito (elige uno por sesión).  
- Elementos:
  - Cabecera con avatar, nivel, racha, estrellas.  
  - Botones grandes; feedback inmediato visual y sonoro (TTS).  
  - CTA “Ir a refuerzo de errores” (repite items fallados).  
- Registro de sesión (para `progress_sessions`): aciertos, errores, duración, %acierto/tiempo.

### 10.5 Panel profesional (`/app-professional`)

- Lista de alumnos asignados.  
- KPIs (PCPM, EPM, accuracy, tiempo en tarea, cumplimiento) + semáforo de riesgo:  
  - Verde ≤10 % error  
  - Amarillo 10–25 %  
  - Rojo >25 %  
- Acciones:
  - Asignación de tareas (fonema/familia numérica).  
  - Exportación de informe semanal a PDF.  
  - Ajuste de objetivos cuantitativos (metas con trazabilidad).

### 10.6 Informe individual (PDF)

- Contenidos:
  - Línea base (post-evaluación inicial).  
  - Tendencia semanal/por bloque.  
  - Mapa de errores y observaciones.  
  - Recomendaciones de práctica para el hogar.
- Generación: servidor (HTML → PDF) o cliente con impresión a PDF controlada.

### 10.7 Configuración y accesibilidad (`/settings`)

- TTS on/off, volumen, contraste alto, tamaño de fuente, tiempo máximo por sesión.  
- Descarga de datos (portabilidad) y borrado de cuenta.  
- Centro de ayuda y FAQ guiada (asistente interno no generativo hacia niños).

---

## 11. IA generativa (backend)

### 11.1 Grok (texto)

- Endpoint expuesto: `POST /api/generate` (Node).  
- Llamada recomendada: mensajes en español, 1–2 frases, registro infantil o profesional según caso.

### 11.2 Hugging Face local (audio/imagen)

- Imagen: delegar al microservicio Python SDXL local.  
- ASR: delegar a `audio_service` local (wav2vec2).  
- TTS: delegar a `audio_service` local (modelo HF español).

---

## 12. Seguridad y cumplimiento (RGPD/LOPDGDD)

- Autenticación: PBKDF2-SHA256 (~100k iteraciones), cookies HttpOnly, Secure, SameSite=Lax, firmadas con `SESSION_SECRET`.  
- Consentimiento parental obligatorio para menores; registrar `consent_version` y `consent_signed_at`.  
- Minimización: solo indicadores pedagógicos (no clínicos).  
- Portabilidad/borrado: endpoints de descarga y eliminación integral de datos.  
- Trazabilidad: logs de acceso a informes con `user_id`, `action`, `ts`.  
- HTTPS: Cloudflare; CORS limitado a dominio productivo.  
- Rate limiting en el backend IA (≈60 rpm).

---

## 13. Métricas y reglas de cálculo (KPIs)

- PCPM: total palabras correctas / minutos de lectura.  
- EPM: total errores / minutos de lectura.  
- Accuracy %: aciertos / (aciertos+errores) * 100.  
- On-task: segundos efectivos en actividad / sesión.  
- Cumplimiento %: sesiones realizadas / plan semanal.  
- Semáforo de riesgo:
  - Verde: EPM ≤ 10 % del total de tokens evaluados.  
  - Amarillo: 10–25 %.  
  - Rojo: > 25 %.

---

## 14. Contenidos y gamificación

- Plan semanal adaptativo: 4 sesiones × 15 min por defecto; recalibra tras cada sesión.  
- Recompensas: estrellas, rachas, niveles, mundos temáticos (vocales, consonantes, familias numéricas).  
- Refuerzo de errores: carpeta con items fallados; CTA al finalizar sesión.  
- Pausas de autorregulación: breve respiración guiada antes de reintentar.

---

## 15. Accesibilidad infantil (recomendaciones)

- Tipografía: sans serif redondeada, interlineado amplio, botones ≥ 44×44 px.  
- Contraste: WCAG AA; validar tokens en `variables.css`.  
- Sonido: opcional y controlable (TTS), vibración/animación moderadas.  
- Tiempo de sesión: por defecto ≤ 15 min; pausa cada 5–7 min si hay fatiga.

---

## 16. Pruebas y observabilidad

- Pruebas funcionales:
  - Registro/login → cookie y acceso a `/app/*`.  
  - Flujo UI infantil → registro de `progress_sessions`.  
  - Panel profesional → visualización de KPIs e informe.  
- Salud de servicios:
  - `GET /health` en backend IA debe devolver `{ ok: true }`.  
- Logs:
  - Backend IA: errores y tiempos en generación de imagen/texto/transcripción.  
  - Servicios Python: latencia por request y uso de CPU/GPU.

---

## 17. Producción y escalado

- Cloudflare Pages/Functions: despliegue desde `frontend/`.  
- D1: monitorizar límites y, si escala, preparar migración a Postgres (con migraciones SQL).  
- AI Backend: contenedor Node en VM/Container; servicios Python en hosts dedicados (GPU si aplica).  
- Política CORS: limitar a dominio final. HTTPS forzado.  
- Filtrado de contenido IA: lista blanca de prompts/temas y post-procesado child-safe.
