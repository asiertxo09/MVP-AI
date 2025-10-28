# Plataforma EduPlay · Guía de desarrollo

> Consulta `docs/README_DEV_Codex.md` para el mapa de directorios actualizado.

Este repositorio contiene el frontend estático (Cloudflare Pages + Functions) y los servicios de backend que alimentan la plataforma EduPlay. Incluye autenticación de usuarios, generación de contenido con Groq, transcripción de audio y generación de imágenes.

## Arquitectura general
- **`frontend/`**: sitio público, formularios de registro/login y API routes en Cloudflare Workers (D1 como base de datos).
- **`ai-backend-groq/`**: backend Node.js que expone endpoints para generar texto y transcribir audio usando Groq + Hugging Face.
- **`ai-services-local/`**: servicios Python opcionales para proxys Groq/HF y generación de imágenes SDXL en local.

```
Navegador ─▶ frontend (Cloudflare)
              ├─ /api/login | /api/register | /api/logout | /api/demo
              └─▶ ai-backend-groq (Node) ─▶ Servicios Groq / Hugging Face
                             └─▶ ai-services-local (Python) ─▶ Proxys locales / SDXL
```

## Requisitos previos
- Node.js 18+ y npm.
- Python 3.10+ (solo si se usará `ai-services-local/sdxl`).
- Cuenta en Cloudflare D1 o SQLite compatible para desarrollo local.
- Claves de API válidas para Groq y Hugging Face.

## Puesta en marcha rápida
### Frontend + Functions (desarrollo local)
```bash
cd frontend
npm install
# Configura variables locales de Cloudflare en wrangler.toml o `.dev.vars`
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
# Proxy Groq/Hugging Face en Flask
pip install -r ai-services-local/groq-proxy/requirements.txt
python ai-services-local/groq-proxy/app.py

# Generador SDXL local
pip install -r ai-services-local/sdxl/requirements.txt
python ai-services-local/sdxl/app.py
```

## Variables de entorno
| Servicio | Variable | Obligatoria | Descripción |
|----------|----------|-------------|-------------|
| Cloudflare Functions | `SESSION_SECRET` | Sí | Clave HMAC para firmar las cookies de sesión. |
| Cloudflare Functions | `DB` | Sí | Enlace a la base D1 (Wrangler la expone automáticamente). |
| Cloudflare Functions | `DEMO_FROM`, `DEMO_TO`, `DEMO_SUBJECT` | Opcionales | Datos para el endpoint `/api/demo`. |
| Node backend | `GROQ_API_KEY` | Sí | Clave para generación de texto con Groq. |
| Node backend | `HUGGING_FACE_API_KEY` o `HF_API_KEY` | Sí | Clave para uso de modelos Hugging Face. |
| Node backend | `HF_IMAGE_MODELS` | Opcional | Lista de modelos de imagen (coma separada). |
| Node backend | `HF_TIMEOUT_MS` | Opcional | Timeout en milisegundos para Hugging Face (default 45000). |
| Node backend | `PORT` | Opcional | Puerto HTTP (default 3001). |
| ai-services-local/sdxl | `HF_API_KEY` | Sí | Token Hugging Face con acceso a los modelos de imagen usados. |

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

### Backend Node (`ai-backend-groq/server.js`)
| Método | Ruta | Descripción | Cuerpo/Respuesta |
|--------|------|-------------|------------------|
| GET | `/health` | Comprobación sencilla del servicio. | Responde `{ ok: true }`. |
| POST | `/api/generate` | Genera texto educativo breve. | Request `{ prompt, level? }`. Respuesta `{ text, tokens, model }`. |
| POST | `/api/transcribe` | Transcribe audio (base64). | Request `{ audio }`. Devuelve `{ text, confidence }`. |
| POST | `/api/image` | Proxy de generación de imagen vía Hugging Face. | Request `{ prompt, enhance? }`. Respuesta PNG (`image/png`). |
| GET | `/api/image` | Versión GET para debug rápido con query `?prompt=`. | Imagen PNG. |
| GET | `/api/debug/hf` | Información diagnóstica de la clave HF (no exponer en prod). | `{ hasKey: boolean, models: [...] }`. |

### Backend Python (`ai-services-local/sdxl/app.py`)
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/image` | Genera imágenes SDXL localmente a partir de `{ prompt }`. |

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