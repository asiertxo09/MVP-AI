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
