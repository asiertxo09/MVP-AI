Backend (Node):
```
npm run dev
```

Backend de imágenes (Python):
```
pip install -r ai-backend-groq/requirements.txt
python ai-backend-groq/app.py
```

Variables de entorno necesarias:
- `GROQ_API_KEY`
- `HF_API_KEY`

Endpoints disponibles:
- `POST /api/generate` texto de apoyo (Groq)
- `POST /api/transcribe` transcripción de audio con Whisper
- `POST /image` (puerto 5001) generación de imágenes con Stable Diffusion XL y prompt seguro

Frontend:
```
npx http-server -p 5500
```
=======
# AI EduPlay - Backend (Groq + Hugging Face)

## Puesta en marcha rápida
```bash
cd ai-backend-groq
npm install
cp .env.example .env   # luego edita con tus claves reales
npm run dev
```
Frontend (por ejemplo usando http-server):
```bash
cd frontend
npx http-server -p 5500
# Abrir http://localhost:5500/eduplay.html
```

## Variables de entorno necesarias
| Variable | Obligatoria | Descripción |
|----------|-------------|-------------|
| `GROQ_API_KEY` | Sí | Clave Groq para generación de texto. |
| `HUGGING_FACE_API_KEY` o `HF_API_KEY` | Sí | Clave Hugging Face (el código acepta cualquiera de los dos nombres). |
| `HF_IMAGE_MODELS` | Opcional | Lista separada por comas de modelos de imagen. Default: `runwayml/stable-diffusion-v1-5,stabilityai/stable-diffusion-2-1-base` |
| `HF_TIMEOUT_MS` | Opcional | Timeout en ms para generación de imagen (default 45000). |
| `PORT` | Opcional | Puerto del backend (default 3001). |

### Ejemplo `.env`
```env
GROQ_API_KEY=tu_clave_groq
HUGGING_FACE_API_KEY=tu_clave_hf
HF_IMAGE_MODELS=runwayml/stable-diffusion-v1-5,stabilityai/stable-diffusion-2-1-base
HF_TIMEOUT_MS=45000
PORT=3001
```
> Puedes usar `HF_API_KEY` en lugar de `HUGGING_FACE_API_KEY` si prefieres. El backend detecta ambos.

## Endpoints
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/health` | Comprobación de estado. |
| POST | `/api/generate` | Genera texto corto de apoyo (JSON: `{ prompt, level? }`). |
| POST | `/api/image` | Genera imagen (JSON: `{ prompt }`) -> devuelve PNG. |
| GET | `/api/image?prompt=...` | Test rápido en navegador (no para producción). |
| POST | `/api/transcribe` | Transcribe audio base64 (JSON: `{ audio }`). |
| GET | `/api/debug/hf` | (Solo dev) Info mínima sobre la clave HF cargada. |

## Sistema de generación de imágenes (Stable Diffusion - Hugging Face)
- Implementado con fallback multi‑modelo y reintentos (503 warmup, 5xx, 429, etc.).
- Cache en memoria (clave = estilo|enhance|prompt) para llamadas repetidas.
- Cabeceras de respuesta: `X-Image-Model` y `X-Image-Cache` (`hit`/`miss`).

## Errores comunes y solución (especialmente 404)
| Síntoma | Causa probable | Solución |
|---------|----------------|----------|
| `404 Not Found` desde Hugging Face | Nombre de variable mal (usaste `HF_API_KEY` pero el código antiguo solo leía `HUGGING_FACE_API_KEY`) | Ahora se aceptan ambos nombres; asegura que una esté definida y sin comillas. |
| `404` o `403` en modelo | No aceptaste los términos/licencia del modelo (algunos son gated) | Entra a la página del modelo en HF y haz click en “Access repository”. |
| `401 Unauthorized` | Clave inválida o vacía | Verifica `.env` y reinicia el backend. |
| `503 loading` repetido | Modelo “cold start” | El backend reintenta automáticamente; espera unos segundos. |
| Timeout/Abort | Modelo lento o red inestable | Aumenta `HF_TIMEOUT_MS` (p.ej. 60000) o reduce carga simultánea. |
| Imagen vacía / content-type JSON | Respuesta de error devuelta como JSON aunque 200 | Backend probará siguiente modelo y registrará log de advertencia. |

### Checklist rápido si falla la imagen
1. `curl http://localhost:3001/health` => debe responder `{ ok: true }`.
2. `curl http://localhost:3001/api/debug/hf` => `hasKey: true` y longitud > 20.
3. Asegúrate de haber aceptado la licencia de cada modelo en HF.
4. Probar GET manual: `curl -o test.png "http://localhost:3001/api/image?prompt=un%20gato%20dibujando"`.
5. Revisar logs: busca líneas `[HF][Image]` para ver modelo, intentos y códigos.
6. Si todos fallan: definir otro modelo en `HF_IMAGE_MODELS` (ej. `stabilityai/sdxl-turbo`).

## Diferencias respecto a la versión anterior
- Se agregó soporte multi‑modelo + reintentos exponenciales.
- Detección de ambas variables de clave HF (`HUGGING_FACE_API_KEY` / `HF_API_KEY`).
- Endpoint GET `/api/image` para debug rápido.
- Cabeceras diagnósticas (`X-Image-Model`, `X-Image-Cache`).
- Polyfill `fetch` automático para Node < 18 (`node-fetch`).
- Ruta `/favicon.ico` (204) para limpiar logs en desarrollo.

## Notas de seguridad
- No expongas `/api/debug/hf` en producción.
- Considera limitar prompts o sanitizar si se expone a usuarios.
- Añade un reverse proxy + TLS (NGINX / Caddy) para despliegue público.

## Próximas mejoras sugeridas
- Persistir cache en disco (LRU) o Redis.
- Añadir colas para limitar simultáneas de imagen.
- Test unitarios con mocks de fetch.
- Observabilidad (p.ej. Prometheus métricas de latencia y tasa de error).

---
**Troubleshooting rápido**: Si sigues viendo `404 Not Found` al generar imágenes, casi siempre es: (a) variable de entorno mal nombrada, (b) no aceptaste licencia del modelo, o (c) modelo retirado. Cambia a otro en `HF_IMAGE_MODELS` y revisa logs.
