import os
import base64
import io
from typing import Optional
from fastapi import FastAPI, HTTPException, File, UploadFile
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from gtts import gTTS
import requests
from dotenv import load_dotenv
import subprocess
from generate_assets import generate_svg_with_llm
# Cargar variables de entorno
load_dotenv()

app = FastAPI(title='EduPlay Unified Backend', version='1.0.0')

# CORS - Permitir todos los orígenes
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)

# Configuración
GROQ_API_KEY = os.getenv('GROQ_API_KEY', '')
GROQ_API_URL = 'https://api.groq.com/openai/v1'

if not GROQ_API_KEY:
    print("⚠️ WARNING: GROQ_API_KEY no configurada")

def check_icon(word):
    # Calculate absolute path to frontend/assets/icons
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    icons_dir = os.path.join(base_dir, 'frontend', 'assets', 'icons')
    
    if not os.path.exists(icons_dir):
        os.makedirs(icons_dir, exist_ok=True)

    file_path = os.path.join(icons_dir, f"{word}.svg")

    if not os.path.exists(file_path):
        print(f"🎨 Icon not found for '{word}', generating at: {file_path}")
        generate_svg_with_llm(word, file_path)

# ==================== MODELS ====================

class TranscribeRequest(BaseModel):
    audio: str = Field(..., description="Audio en base64")
    format: str = Field(default='wav', description="Formato del audio")
    language: str = Field(default='es', description="Idioma del audio")

class TTSRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=600)
    language: str = Field(default='es')
    speed: float = Field(default=1.0, ge=0.5, le=2.0)

class ChatRequest(BaseModel):
    messages: list
    model: str = Field(default='openai/gpt-oss-120b')
    temperature: float = Field(default=0.7, ge=0, le=2)
    max_tokens: int = Field(default=1024, ge=1, le=8000)

class GenerateRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=2000)
    model: str = Field(default='openai/gpt-oss-120b')
    temperature: float = Field(default=0.7, ge=0, le=2)
    max_tokens: int = Field(default=1024, ge=1, le=8000)

# ==================== HEALTH CHECK ====================

@app.get('/health')
async def health():
    return {
        'ok': True,
        'service': 'eduplay-backend',
        'version': '1.0.0',
        'groq_configured': bool(GROQ_API_KEY),
        'endpoints': {
            'transcribe': '/transcribe',
            'tts': '/tts',
            'chat': '/chat'
        }
    }

# ==================== TRANSCRIPTION (WHISPER via GROQ) ====================

@app.post('/transcribe')
async def transcribe(request: TranscribeRequest):
    """
    Transcribe audio usando Groq's Whisper API
    """
    if not GROQ_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="Groq API key no configurada"
        )

    try:
        # Decodificar base64
        audio_data = request.audio
        if ',' in audio_data:
            audio_data = audio_data.split(',')[1]

        audio_bytes = base64.b64decode(audio_data)

        # Groq Whisper API requiere un archivo
        # Crear un archivo temporal en memoria
        files = {
            'file': (f'audio.{request.format}', io.BytesIO(audio_bytes), f'audio/{request.format}')
        }

        data = {
            'model': 'whisper-large-v3',
            'language': request.language,
            'response_format': 'json'
        }

        headers = {
            'Authorization': f'Bearer {GROQ_API_KEY}'
        }

        print(f"🎤 Enviando audio a Groq Whisper API...")

        response = requests.post(
            f'{GROQ_API_URL}/audio/transcriptions',
            headers=headers,
            files=files,
            data=data,
            timeout=30
        )

        if not response.ok:
            error_detail = response.text
            print(f"❌ Error de Groq: {response.status_code} - {error_detail}")
            raise HTTPException(
                status_code=response.status_code,
                detail=f"Error de Groq API: {error_detail}"
            )

        result = response.json()
        text = result.get('text', '').strip()

        print(f"✅ Transcripción exitosa: {text[:100]}...")

        return {
            'text': text,
            'confidence': 0.95,  # Groq no devuelve confidence, usamos valor alto
            'language': request.language,
            'model': 'whisper-large-v3'
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error en transcripción: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Error al transcribir audio: {str(e)}"
        )

# ==================== TEXT-TO-SPEECH ====================

@app.post('/tts')
async def text_to_speech(request: TTSRequest):
    """
    Convierte texto a voz usando gTTS
    """
    try:
        tts = gTTS(
            text=request.text,
            lang=request.language,
            slow=(request.speed < 0.9)
        )

        mp3_buffer = io.BytesIO()
        tts.write_to_fp(mp3_buffer)
        mp3_buffer.seek(0)
        audio_bytes = mp3_buffer.getvalue()

        return Response(
            content=audio_bytes,
            media_type='audio/mp3',
            headers={
                'X-Audio-Model': 'gTTS',
                'Access-Control-Allow-Origin': '*'
            }
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f'Error TTS: {str(e)}'
        )

# ==================== CHAT (GROQ LLM) ====================

@app.post('/chat')
async def chat(request: ChatRequest):
    """
    Chat completion usando Groq API
    """
    if not GROQ_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="Groq API key no configurada"
        )

    try:
        headers = {
            'Authorization': f'Bearer {GROQ_API_KEY}',
            'Content-Type': 'application/json'
        }

        payload = {
            'model': request.model,
            'messages': request.messages,
            'temperature': request.temperature,
            'max_tokens': request.max_tokens
        }

        response = requests.post(
            f'{GROQ_API_URL}/chat/completions',
            headers=headers,
            json=payload,
            timeout=30
        )

        if not response.ok:
            raise HTTPException(
                status_code=response.status_code,
                detail=f"Error de Groq API: {response.text}"
            )

        return response.json()

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error en chat: {str(e)}"
        )

# ==================== GENERATE (GROQ LLM) ====================

@app.post('/api/generate')
async def generate(request: GenerateRequest):
    """
    Generación de texto usando Groq API (compatible con frontend)
    """
    if not GROQ_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="Groq API key no configurada"
        )

    try:
        headers = {
            'Authorization': f'Bearer {GROQ_API_KEY}',
            'Content-Type': 'application/json'
        }

        payload = {
            'model': request.model,
            'messages': [
                {'role': 'user', 'content': request.prompt}
            ],
            'temperature': request.temperature,
            'max_tokens': request.max_tokens
        }

        response = requests.post(
            f'{GROQ_API_URL}/chat/completions',
            headers=headers,
            json=payload,
            timeout=30
        )

        if not response.ok:
            raise HTTPException(
                status_code=response.status_code,
                detail=f"Error de Groq API: {response.text}"
            )

        result = response.json()
        text = result['choices'][0]['message']['content']

        return {
            'text': text,
            'model': request.model,
            'usage': result.get('usage', {})
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error en generate: {str(e)}"
        )

# ... imports ...
from longitudinal_logic import SpiralingEngine, SkillGraph

# ... existing code ...

class GenerateLevelRequest(BaseModel):
    gameType: str = Field(..., description="Type of game: math, phoneme, dictation, fluency")
    difficulty: str = Field(default="easy", description="easy, medium, hard")
    limit: int = Field(default=5, ge=1, le=10)
    target: Optional[str] = Field(default=None, description="Target phoneme or concept")
    # New Context Fields
    phoneme_history: Optional[dict] = Field(default=None, description="{ 'm': timestamp }")
    mistakes: Optional[list] = Field(default=None, description="['p', 'b']")
    skill_mastery: Optional[dict] = Field(default=None, description="{ 'decoding': true }")
    target_skill: Optional[str] = Field(default=None, description="The specific skill being trained e.g. 'fluency'")

@app.post('/api/generate-levels')
async def generate_levels(request: GenerateLevelRequest):
    """
    Generates dynamic game levels using Groq with Longitudinal Logic
    """
    if not GROQ_API_KEY:
        raise HTTPException(status_code=503, detail="Groq API key missing")

    # 1. Longitudinal Gatekeeping (Skill Graph)
    if request.target_skill and request.skill_mastery:
        graph = SkillGraph()
        check = graph.validate_level_request(request.target_skill, request.skill_mastery)
        if not check['allowed']:
            # BLOCKED: Return a bridge level instead?
            # ideally we return a special response code, but to be safe for frontend, 
            # let's just generate the BRIDGE skill instead and notify.
            print(f"🔒 Skill Gate: Blocked '{request.target_skill}' due to missing '{check['missing']}'. Swapped to Bridge Level.")
            request.gameType = 'phoneme' # Bridge usually phonemics
            request.target_skill = check['bridge_skill']
            # We continue generation but for the bridge skill
            
    # 2. Spiraling Engine (Review Injection)
    review_items = []
    if request.gameType == 'phoneme':
        engine = SpiralingEngine(high_decay_days=14)
        review_items = engine.get_review_items(request.phoneme_history, request.mistakes)
        # Limit review items to max 2 to not overwhelm
        review_items = review_items[:2]

    prompt = ""
    # ... (existing math logic) ...
    if request.gameType == 'math':
        prompt = f"""
        Generate {request.limit} {request.difficulty} math problems for a 5-7 year old. 
        Operations: Addition/Subtraction.
        Format: JSON Array only.
        Example: [{{"q": "2 + 2", "a": 4, "ops": "+"}}]
        Response must be ONLY valid JSON.
        """
    elif request.gameType == 'phoneme':
        # ... logic ...
        target_phoneme = request.target
        
        # Priority Logic: 
        # If no explicit target, try to use a Review Item as the MAIN target
        if not target_phoneme and review_items:
             target_phoneme = review_items[0]
             print(f"🔄 Spiraling: Selected Review Item '{target_phoneme}' as main target.")
             review_items = review_items[1:] # Remove used one

        if not target_phoneme:
             # Random fallback logic (existing)
             import random
             target_phoneme = random.choice(['M', 'P', 'S', 'L', 'T'])

        target_instruction = f"ALL correct words MUST start with the Spanish letter '{target_phoneme}'."
        distractor_instruction = f"Generate 1-3 distractor words that do NOT start with '{target_phoneme}'."
        
        review_instruction = ""
        if review_items:
             review_instruction = f"ALSO, inject 1-2 questions testing these specific review phonemes: {', '.join(review_items)}."

        prompt = f"""
        Generate a phoneme identification game level in Spanish.
        Target Phoneme: "{target_phoneme}"
        {target_instruction}
        {distractor_instruction}
        {review_instruction}
        
        Return exactly {request.limit} items total.
        Structure:
        [
          {{ "word": "Mesa", "icon": "mesa", "isTarget": true }},
          {{ "word": "Sol", "icon": "sol", "isTarget": false }}
        ]
        
        CRITICAL: 
        1. "isTarget" must be true ONLY for words starting with '{target_phoneme}' (OR the review phonemes if included).
        2. Simple vocabulary for a 5-7 year-old.
        3. Do NOT use words containing the letter "Ñ".
        4. Response must be ONLY valid JSON array.
        """
    else:
         raise HTTPException(status_code=400, detail="Unknown game type")

    try:
        # ... existing Groq call ...
        headers = {
            'Authorization': f'Bearer {GROQ_API_KEY}',
            'Content-Type': 'application/json'
        }
        
        payload = {
            'model': 'openai/gpt-oss-120b',
            'messages': [{'role': 'user', 'content': prompt}],
            'temperature': 0.7,
            'response_format': {"type": "json_object"} 
        }

        response = requests.post(f'{GROQ_API_URL}/chat/completions', headers=headers, json=payload, timeout=30)
        
        # ... (rest of existing error handling and parsing) ...
        if not response.ok:
             raise HTTPException(status_code=response.status_code, detail=response.text)

        result = response.json()
        content = result['choices'][0]['message']['content']
        
        # ... JSON Parsing (Reusing existing logic slightly modified/cleaned if needed, 
        # but for replace_file_content we assume keeping the existing block structure below) ...
        
        # (This block is just context for where we are, not full replacement yet)
        # We need to render the parsing logic too since we replaced the whole function signature
        
        import json
        try:
            clean_content = content.replace("```json", "").replace("```", "").strip()
            data = json.loads(clean_content)
            
            if isinstance(data, dict):
                for k, v in data.items():
                    if isinstance(v, list):
                        data = v
                        break
            if not isinstance(data, list):
                 if isinstance(data, dict): pass 
                 else: data = []
            
            if isinstance(data, list):
                valid_data = []
                for item in data:
                    word = item.get('word')
                    if not word or str(word).lower() == 'none' or str(word).lower() == 'null' or 'ñ' in str(word).lower():
                        continue
                    item['word'] = str(word)
                    check_icon(item['word'].lower())
                    valid_data.append(item)
                data = valid_data
            
            # Inject metadata about why this level was generated
            return {
                "levels": data, 
                "meta": {
                    "target": target_phoneme if request.gameType == 'phoneme' else None,
                    "spiraled_items": review_items if request.gameType == 'phoneme' else [],
                    "gate_status": "open" if not (request.target_skill and request.skill_mastery) else "checked"
                }
            }
        except Exception as e:
            print(f"JSON Parse Error: {e} - Content: {content}")
            return {"levels": [], "error": "Failed to parse AI response"}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class SpeakingChatRequest(BaseModel):
    message: str
    context: Optional[str] = None

@app.post('/api/speaking-chat')
async def speaking_chat(request: SpeakingChatRequest):
    """
    Returns a short (max 4 words) conversational response to child's speech.
    """
    if not GROQ_API_KEY:
        raise HTTPException(status_code=503, detail="Groq API key missing")

    prompt = f"""
    You are a friendly AI companion for a 5-year-old child. 
    The child says: "{request.message}"
    Respond in Spanish. 
    CRITICAL RULES:
    1. DO NOT repeat what the child said.
    2. Respond with a maximum of 4 words.
    3. Be encouraging and curious.
    
    Response:
    """

    try:
        headers = {
            'Authorization': f'Bearer {GROQ_API_KEY}',
            'Content-Type': 'application/json'
        }
        
        payload = {
            'model': 'openai/gpt-oss-120b',
            'messages': [{'role': 'user', 'content': prompt}],
            'temperature': 0.8,
            'max_tokens': 20
        }

        response = requests.post(f'{GROQ_API_URL}/chat/completions', headers=headers, json=payload, timeout=20)
        
        if not response.ok:
             raise HTTPException(status_code=response.status_code, detail=response.text)

        result = response.json()
        content = result['choices'][0]['message']['content'].strip().strip('"')
        
        # Enforce 4 word limit just in case
        words = content.split()
        if len(words) > 4:
            content = " ".join(words[:4]) + "!"

        return {"reply": content}

    except Exception as e:
        print(f"Speaking Chat Error: {e}")
        return {"reply": "¡Qué bien suena eso!"}

@app.options("/api/speaking-chat")
async def speaking_chat_options():
    return Response(
        status_code=200,
        headers={
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': '*',
        }
    )

@app.options("/api/generate-levels")
async def generate_levels_options():
    return Response(
        status_code=200,
        headers={
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': '*',
        }
    )

# ==================== CORS PREFLIGHT HANDLERS (Existing) ====================

@app.options("/transcribe")
async def transcribe_options():
    return Response(
        status_code=200,
        headers={
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': '*',
        }
    )

@app.options("/tts")
async def tts_options():
    return Response(
        status_code=200,
        headers={
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': '*',
        }
    )

@app.options("/chat")
async def chat_options():
    return Response(
        status_code=200,
        headers={
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': '*',
        }
    )

@app.options("/api/generate")
async def generate_options():
    return Response(
        status_code=200,
        headers={
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': '*',
        }
    )

# ==================== DIAGNOSTIC BRAIN ENDPOINT ====================

from diagnostic_brain import DiagnosticBrain

class DiagnosticRequest(BaseModel):
    session_logs: list
    total_sessions: int = 1

@app.post("/api/diagnostic/analyze")
async def analyze_diagnostic_session(request: DiagnosticRequest):
    """
    Analyzes raw session logs to detect learning risks (Dyslexia, ADHD).
    """
    try:
        brain = DiagnosticBrain()
        result = brain.analyze_session(request.session_logs, request.total_sessions)
        return result
    except Exception as e:
        print(f"Diagnostic Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.options("/api/diagnostic/analyze")
async def diagnostic_options():
    return Response(
        status_code=200,
        headers={
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': '*',
        }
    )

# ==================== STARTUP ====================

if __name__ == '__main__':
    import uvicorn
    # Usar PORT_PYTHON del .env, fallback a PORT, y luego a 5001
    port = int(os.getenv('PORT_PYTHON') or os.getenv('PORT', 5001))
    print(f"🚀 Starting EduPlay Backend on port {port}")
    print(f"📡 Groq API: {'✅ Configured' if GROQ_API_KEY else '❌ Not configured'}")
    uvicorn.run(
        app,
        host='0.0.0.0',
        port=port,
        log_level="info"
    )
