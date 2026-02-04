# Guía de estructura · EduPlay Codex

Este documento define la estructura de carpetas esperada para el monorepo de EduPlay. Cada servicio debe mantener sus dependencias, configuración y documentación local en la ruta indicada.

```
/
├─ docs/README_DEV_Codex.md        ← Este documento
├─ frontend/                       ← Cloudflare Pages + Functions
│   ├─ functions/                  ← API Routes y middleware
│   │   ├─ api/                    ← Endpoints HTTP (login, register, ...)
│   │   └─ lib/                    ← Utilidades compartidas (auth, session, ...)
│   ├─ migrations/                 ← Migraciones D1 numeradas secuencialmente
│   ├─ assets/, app/, *.html       ← Sitio estático
│   └─ wrangler.toml               ← Plantilla de configuración (no subir secretos, añade el binding D1 en archivos locales)
├─ ai-backend-groq/                ← Backend Node.js (Groq + Hugging Face)
│   ├─ server.js                   ← Servidor Express principal
│   ├─ package.json                ← Scripts npm y dependencias Node
│   └─ .env.example                ← Variables requeridas/optativas
└─ ai-services-local/              ← Servicios opcionales para ejecución local
    ├─ groq-proxy/                 ← Proxy Flask hacia Groq/HF (uso avanzado)
    │   ├─ app.py
    │   └─ requirements.txt
    └─ sdxl/                       ← Generación de imágenes SDXL local
        ├─ app.py
        └─ requirements.txt
```

### Reglas principales
- Mantén los servicios Python dentro de `ai-services-local/` para evitar mezclarlos con el backend Node.
- Las migraciones de D1 deben vivir en `frontend/migrations/` y seguir el esquema `NNNN_descripcion.sql`.
- Toda configuración de ejemplo debe almacenarse como plantilla (`wrangler.toml`, `.env.example`, etc.) sin credenciales reales.
- El binding de D1 (`DB`) debe configurarse fuera del repositorio (archivo local o ajustes de Pages) antes de ejecutar funciones.
- La lógica compartida de autenticación (hashing, sesiones) reside en `frontend/functions/lib/` y se reutiliza desde los endpoints.

### Flujo recomendado de trabajo
1. Clona el repositorio y revisa este documento para ubicar el servicio que vas a modificar.
2. Copia los archivos de configuración de ejemplo (`wrangler.toml`, `.env.example`) y completa los secretos de forma local.
3. Ejecuta las migraciones con los scripts disponibles en `frontend/package.json` antes de levantar el entorno.
4. Añade documentación adicional en `docs/` si se incorpora un nuevo servicio o flujo.
