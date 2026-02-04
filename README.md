# Plataforma EduPlay · Guía de desarrollo

> Consulta `docs/README_DEV_Codex.md` para el mapa de directorios actualizado.

Este repositorio contiene el frontend estático (Cloudflare Pages + Functions) y los servicios de backend que alimentan la plataforma EduPlay. Incluye autenticación de usuarios, generación de contenido con Groq, transcripción de audio y generación de imágenes.

## Arquitectura general
- **`frontend/`**: sitio público, formularios de registro/login y API routes en Cloudflare Workers (D1 como base de datos).
- **`ai-backend-groq/`**: backend Node.js que expone endpoints para generar texto y transcribir audio usando Groq + Hugging Face.
- **`ai-services-local/`**: servicios Python locales para imágenes SDXL y audio (ASR/TTS) usando pipelines de Hugging Face.

```
Navegador ─▶ frontend (Cloudflare)
              ├─ /api/login | /api/register | /api/logout | /api/demo
              └─▶ ai-backend-groq (Node) ─▶ Servicios Groq / Hugging Face
                             └─▶ ai-services-local (Python) ─▶ Proxys locales / SDXL
```

## Requisitos previos
- Node.js 18+ y npm.
- Python 3.10+ (requerido para `sdxl_service` y `audio_service`).
- Cuenta en Cloudflare D1 o SQLite compatible para desarrollo local.
- Claves de API válidas para Groq y Hugging Face.

## Puesta en marcha rápida
### Frontend + Functions (desarrollo local)
```bash
cd frontend
npm install
# Copia `wrangler.toml` a un archivo local (p. ej. `wrangler.local.toml`) y añade tu binding D1
# o configura el binding directamente en la UI de Cloudflare Pages.
# Completa también `.dev.vars` si necesitas variables adicionales.
npm run dev # levanta el preview con Wrangler
```

### Backend Groq / Hugging Face (Node.js)
```bash
cd ai-backend-groq
npm install
cp .env.example .env  # completa tus claves
npm run dev
```

### Servicios de IA locales (opcional)
```bash
# Generador SDXL local (FastAPI)
pip install -r ai-services-local/sdxl_service/requirements.txt
uvicorn ai-services-local.sdxl_service.app:app --host 0.0.0.0 --port 5005

# Servicio de audio local (ASR/TTS)
pip install -r ai-services-local/audio_service/requirements.txt
uvicorn ai-services-local.audio_service.app:app --host 0.0.0.0 --port 5006
```

> Nota: backend y microservicios comparten los endpoints de salud `/health`, `/health/live` y `/health/ready` para facilitar la monitorización local y en producción.


## Variables de entorno
| Servicio | Variable | Obligatoria | Descripción |
|----------|----------|-------------|-------------|
| Cloudflare Functions | `SESSION_SECRET` | Sí | Clave HMAC para firmar las cookies de sesión. |
| Cloudflare Functions | `DB` | Sí | Enlace a la base D1 (Wrangler la expone automáticamente). |
| Cloudflare Functions | `DEMO_FROM`, `DEMO_TO`, `DEMO_SUBJECT` | Opcionales | Datos para el endpoint `/api/demo`. |
| Node backend | `GROQ_API_KEY` | Sí | Clave para generación de texto con Groq. |
| Node backend | `HUGGING_FACE_API_KEY` o `HF_API_KEY` | Requerida si no se usa `LOCAL_SDXL_URL` | Token para inferencia en Hugging Face. |
| Node backend | `HF_IMAGE_MODELS` | Opcional | Lista de modelos de imagen (coma separada). |
| Node backend | `CORS_ORIGIN` | Recomendado | Lista de orígenes permitidos (coma separada). |
| Node backend | `LOCAL_SDXL_URL` | Opcional | URL del servicio SDXL local (`http://127.0.0.1:5005/image`). |
| Node backend | `LOCAL_ASR_URL` | Opcional | URL del endpoint de transcripción (`http://127.0.0.1:5006/transcribe`). |
| Node backend | `LOCAL_TTS_URL` | Opcional | URL del endpoint TTS (`http://127.0.0.1:5006/tts`). |
| Node backend | `PORT` | Opcional | Puerto HTTP (default 3001). |
| ai-services-local/sdxl_service | `LOCAL_SDXL_MODEL` | Opcional | ID del modelo Diffusers (default SDXL base 1.0). |
| ai-services-local/audio_service | `LOCAL_ASR_MODEL` | Opcional | Modelo ASR de Hugging Face (default `openai/whisper-small`). |
| ai-services-local/audio_service | `LOCAL_TTS_MODEL`, `LOCAL_TTS_VOICE` | Opcionales | Modelo y voz para TTS (default `facebook/mms-tts-es`). |

## Base de datos y autenticación
- La tabla `users` se crea automáticamente en D1 con columnas para credenciales hasheadas (`password_hash`, `password_salt`, `password_iterations`, `password_algo`).
- Las contraseñas se almacenan usando PBKDF2 (SHA-256, 100k iteraciones por defecto).
- El login devuelve una cookie de sesión firmada (`session`) válida por 24 h que es verificada en `_middleware.js` para proteger rutas `/app/*`.

### Flujo de registro
1. El formulario `register.html` valida nombre, usuario/correo, contraseña y consentimiento.
2. Envia `POST /api/register` con JSON `{ username, password }` (los demás campos se ignoran en backend).
3. La función registra al usuario si no existe y responde `201 Created`.

### Flujo de login
1. `login.html` envía `POST /api/login` con `{ username, password }`.
2. La función busca al usuario en D1, verifica la contraseña y emite la cookie `session`.
3. El middleware redirige a `/login` cuando el token falta o expira.

## Endpoints disponibles
### Cloudflare Functions (`frontend/functions/api`)
| Método | Ruta | Descripción | Respuestas relevantes |
|--------|------|-------------|-----------------------|
| POST | `/api/register` | Crea un usuario nuevo. Cuerpo: `{ username: string, password: string }`. | `201 Created` en éxito, `409` si el usuario existe, `400` si los datos son inválidos. |
| POST | `/api/login` | Inicia sesión y entrega cookie `session`. Cuerpo: `{ username, password }`. | `200 OK` con `Set-Cookie`, `401` si credenciales inválidas. |
| POST | `/api/logout` | Elimina la cookie de sesión. | `200 OK` con `Set-Cookie` vacío. |
| POST | `/api/demo` | Envía un correo de demo (requiere variables `DEMO_*`). | `200` si se envía, `400/500` en error. |

### Backend Node (`ai-backend-groq`)
| Método | Ruta | Descripción | Cuerpo/Respuesta |
|--------|------|-------------|------------------|
| GET | `/health` | Estado general del backend. | `{ ok, service, uptime }`. |
| GET | `/health/live` | Check ligero para balanceadores. | `{ ok: true, status: 'live' }`. |
| GET | `/health/ready` | Verifica dependencias externas (Groq, SDXL, ASR/TTS). | `{ ok, status, dependencies }`. |
| POST | `/api/generate` | Genera texto educativo breve. | Request `{ prompt, level? }`. Respuesta `{ text }`. |
| POST | `/api/transcribe` | Envía audio base64 al servicio local ASR. | Request `{ audio, format?, language? }`. Respuesta `{ text, confidence }`. |
| POST | `/api/image` | Proxy de generación de imágenes (SDXL local o Hugging Face). | Request `{ prompt, style? }`. Respuesta PNG (`image/png`). |

### Servicios Python (`ai-services-local`)
#### `sdxl_service/app.py`
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/health` | Información general del servicio SDXL. |
| GET | `/health/live` | Check ligero de vida. |
| GET | `/health/ready` | Indica si el pipeline SDXL está cargado. |
| POST | `/image` | Genera imágenes en PNG a partir de `{ prompt, style?, ... }`. |

#### `audio_service/app.py`
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/health` | Información general del servicio de audio. |
| GET | `/health/live` | Check ligero de vida. |
| GET | `/health/ready` | Indica si los pipelines ASR/TTS están listos. |
| POST | `/transcribe` | Transcribe audio base64 normalizado a 16 kHz. |
| POST | `/tts` | Genera audio WAV desde texto `{ text, voice?, speed? }`. |

## Desarrollo de interfaces
- Las páginas `login.html` y `register.html` incluyen márgenes laterales fluidos (`clamp`) para mejorar la legibilidad en pantallas pequeñas.
- El layout principal (`index.html`) emplea variables CSS y rejillas responsivas.

## Scripts útiles
| Comando | Ubicación | Acción |
|---------|-----------|--------|
| `npm run dev` | `frontend/` | Inicia el preview de Cloudflare Pages/Functions. |
| `npm run migrations:list` | `frontend/` | Lista el estado de las migraciones D1 asociadas al binding `DB`. |
| `npm run migrations:apply` | `frontend/` | Aplica las migraciones pendientes al entorno remoto configurado. |
| `npm run migrations:apply:local` | `frontend/` | Ejecuta las migraciones usando la base local de Wrangler (`--local`). |
| `npm run deploy` | `frontend/` | Publica el sitio (configurar en `package.json`). |
| `npm run dev` | `ai-backend-groq/` | Levanta el servidor Node con recarga automática. |
| `node server.js` | `ai-backend-groq/` | Ejecuta el backend en modo producción. |
| `npm test` | `ai-backend-groq/` | Ejecuta las pruebas de integración (Vitest + Supertest). |

## Buenas prácticas
- Asegura `SESSION_SECRET` con al menos 32 caracteres aleatorios.
- Habilita HTTPS y la opción `Secure` en cookies (ya activado por defecto en Cloudflare).
- Usa cuentas de servicio separadas para entornos de desarrollo y producción.
- Ejecuta las migraciones de D1 (`frontend/migrations/`) antes de desplegar para garantizar el esquema correcto.

Para dudas adicionales consulta el código fuente en cada carpeta o abre un issue en el repositorio.

# Steps to Run the Webpage Locally

From frontend directory, run:

```bash
npm run dev
```

This will start the Cloudflare Pages preview server along with the Functions (API routes) locally. Make sure you have set up your local environment variables in `wrangler.toml` or `.dev.vars` file as needed.

Also check the lastest migrations of the database in `frontend/migrations/` and run them in your local D1 instance to ensure the database schema is up to date.

## Deployment
Antes de desplegar, añade el binding **DB** en *Settings → Functions → D1 Databases* dentro del proyecto de Cloudflare Pages o crea un archivo de entorno (por ejemplo `wrangler.production.toml`) con el bloque `[[d1_databases]]` apuntando a tu base.

To deploy the DB migration run:

```bash
wrangler d1 migrations apply DB --local
rm -r .wrangler/state/v3/d1
```

Once the changes are applied, you need to create a new migration. In the frontend/migrations/ directory, create a new SQL file with the naming convention NNNN_description.sql:
touch frontend/migrations/0003_your_description.sql

````bash
touch frontend/migrations/0003_your_description.sql
````

Edit the migration file and add your SQL statements:
```sql
-- Migration: Add new column to users table
ALTER TABLE users ADD COLUMN new_column_name TEXT;

-- Or create a new table
CREATE TABLE IF NOT EXISTS new_table (
id INTEGER PRIMARY KEY AUTOINCREMENT,
name TEXT NOT NULL,
created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```
After editing the migration file, you can apply the new migration to your local D1 instance:
```bash
wrangler d1 migrations apply DB --local
```

Check that your migration worked:

```bash
wrangler d1 execute DB --local --command "PRAGMA table_info(users);"
```

Once tested locally and committed to version control, apply it to production:

```bash
wrangler d1 migrations apply DB --remote
```

# Ver logs

To view logs for your Cloudflare Functions, you can use the following command:

```bash
wrangler pages deployment tail
```