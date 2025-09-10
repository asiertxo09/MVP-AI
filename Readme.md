Backend:
```
npm run dev
```

Variables de entorno necesarias:
- `GROQ_API_KEY`
- `HF_API_KEY`

Endpoints disponibles:
- `POST /api/generate` texto de apoyo (Groq)
- `POST /api/image` imágenes vía Stable Diffusion (Hugging Face)
- `POST /api/transcribe` transcripción de audio con Whisper

Frontend:
```
npx http-server -p 5500
```
