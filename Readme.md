# AI EduPlay – MVP (EdTech con IA)

Proyecto demo para mostrar un **AI Power Stack** en la industria **EdTech (5–12 años)**.  
Incluye actividades de **matemáticas, escritura, habla, dibujo con IA y transcripción**.  
Demo pensada para un **elevator pitch de 5 minutos** y creado mediante vibe coding.

---

## 🚀 Stack
- **Backend texto:** [Groq](https://groq.com) SDK (`openai/gpt-oss-20b`)  
- **Imágenes:** Hugging Face Inference (SDXL) + fallback **SDXL local** vía FastAPI  
- **Audio:** Whisper-small (Hugging Face Inference)  
- **Frontend:** `frontend/eduplay.html` (HTML+JS standalone, 5 módulos)  
- **Seguridad:** Filtros de contenido y rate limiting  
- **Infra:** Node.js (server.js), Flask (seguridad), FastAPI (imagen local)

---

## 📦 Requisitos
- [Node.js 18+](https://nodejs.org/)  
- [Python 3.10+](https://www.python.org/)  
- Navegador moderno (Chrome, Edge, Firefox)  
- GPU opcional para correr SDXL local

---

## 🔑 Variables de entorno
Crea un archivo `.env` en la raíz con:

```bash
# Claves externas
GROQ_API_KEY=tu_api_key
HF_API_KEY=tu_api_key
# Fallback local de imágenes
LOCAL_SDXL_URL=http://localhost:5005/generate

# Puertos
NODE_PORT=3001
FLASK_PORT=5001
SDXL_PORT=5005
````

⚙️ Instalación
1. Clonar y preparar
````bash
git clone https://github.com/asiertxo09/MVP-AI.git
cd MVP-AI
````

2. Backend de texto (Node.js + Groq)
```bash
cd backend
npm install
node server.js
```


Corre en http://localhost:3001.

3. Backend de seguridad (Flask)
```bash
cd flask-server
pip install -r requirements.txt
python app.py
```


Corre en http://localhost:5001.

4. Fallback de imágenes (FastAPI + SDXL local, opcional)
```bash
cd fastapi-server
pip install -r requirements.txt
uvicorn app:app --host 0.0.0.0 --port 5005
```

Abrir: http://localhost:5500/eduplay.html
