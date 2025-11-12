import base64
import io
import os
import time
from typing import Optional
import numpy as np
import soundfile as sf
import torch
import torchaudio
from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from transformers import pipeline
from gtts import gTTS

SERVICE_NAME = 'audio-service'
TARGET_SAMPLE_RATE = 16_000

# Detect if running in Render (production) or local
IS_RENDER = os.getenv('RENDER', 'false').lower() == 'true'

# Force CPU in Render since they don't have GPU
if IS_RENDER:
    DEVICE_INDEX = -1
    DTYPE = torch.float32
else:
    DEVICE_INDEX = 0 if torch.cuda.is_available() else -1
    DTYPE = torch.float16 if torch.cuda.is_available() else torch.float32

# Use a smaller model from Hugging Face Hub for production
# This will be downloaded automatically on first use
ASR_MODEL_ID = os.getenv('LOCAL_ASR_MODEL', 'openai/whisper-tiny' if IS_RENDER else '../models/whisper-small')

app = FastAPI(title='Local Audio Service', version='1.0.0')

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_asr_pipeline = None

class TranscribeRequest(BaseModel):
    audio: str = Field(..., min_length=10)
    format: str = Field(default='wav') # Expecting WAV from the client
    language: Optional[str] = Field(default='es')

class TTSRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=600)
    language: str = Field(default='es')
    speed: float = Field(default=1.0, ge=0.5, le=2.0)

def decode_audio(payload: TranscribeRequest) -> tuple[torch.Tensor, int]:
    try:
        audio_data = payload.audio
        if ',' in audio_data:
            audio_data = audio_data.split(',')[1]

        data = base64.b64decode(audio_data)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f'Audio base64 inválido: {str(exc)}') from exc

    buffer = io.BytesIO(data)
    try:
        # The client is sending WAV, so we only need soundfile
        waveform, sample_rate = sf.read(buffer, dtype='float32')
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f'No se pudo decodificar el audio WAV. Error: {e}'
        ) from e

    if waveform.ndim > 1:
        waveform = np.mean(waveform, axis=1)

    tensor = torch.from_numpy(waveform.astype(np.float32))

    if sample_rate != TARGET_SAMPLE_RATE:
        resampler = torchaudio.transforms.Resample(orig_freq=sample_rate, new_freq=TARGET_SAMPLE_RATE)
        tensor = resampler(tensor)

    return tensor, TARGET_SAMPLE_RATE


def ensure_asr_pipeline():
    global _asr_pipeline
    if _asr_pipeline is None:
        start = time.time()
        print(f"[ASR] Cargando modelo desde: {ASR_MODEL_ID}")
        print(f"[ASR] Device: {'CPU' if DEVICE_INDEX == -1 else 'CUDA'}")
        try:
            _asr_pipeline = pipeline(
                task='automatic-speech-recognition',
                model=ASR_MODEL_ID,
                torch_dtype=DTYPE,
                device=DEVICE_INDEX,
            )
            elapsed = int((time.time() - start) * 1000)
            print(f"[ASR] Modelo cargado en {elapsed}ms")
        except Exception as e:
            print(f"[ASR] Error cargando modelo: {e}")
            raise HTTPException(status_code=503, detail=f"Error cargando modelo ASR: {str(e)}")
    return _asr_pipeline

@app.get('/health')
async def health():
    return {
        'ok': True,
        'service': SERVICE_NAME,
        'models': {'asr': ASR_MODEL_ID, 'tts': 'gTTS'},
        'environment': 'production' if IS_RENDER else 'development',
        'device': 'cpu' if DEVICE_INDEX == -1 else 'cuda'
    }

@app.post('/transcribe')
async def transcribe(request: TranscribeRequest):
    try:
        waveform_tensor, sample_rate = decode_audio(request)
        pipe = ensure_asr_pipeline()

        # El pipeline de Whisper espera un diccionario con 'raw' y 'sampling_rate'
        audio_input = {
            "raw": waveform_tensor.numpy(),
            "sampling_rate": sample_rate
        }

        print(f"[ASR] Transcribiendo audio: {waveform_tensor.shape}, sample_rate={sample_rate}")

        result = pipe(
            audio_input,
            generate_kwargs={'language': request.language, 'task': 'transcribe'} if request.language else {},
        )

        print(f"[ASR] Resultado: {result}")

        text = (result.get('text') or '').strip()
        confidence = 0.9

        return {
            'text': text,
            'confidence': confidence,
            'language': request.language
        }
    except Exception as exc:
        print(f"[ASR] Error en transcripción: {exc}")
        if isinstance(exc, HTTPException):
            raise exc
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post('/tts')
async def text_to_speech(request: TTSRequest):
    try:
        tts = gTTS(text=request.text, lang=request.language, slow=(request.speed < 0.9))
        mp3_buffer = io.BytesIO()
        tts.write_to_fp(mp3_buffer)
        mp3_buffer.seek(0)
        audio_bytes = mp3_buffer.getvalue()
        return Response(
            content=audio_bytes,
            media_type='audio/mp3',
            headers={'X-Audio-Model': 'gTTS'}
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f'Error TTS: {str(exc)}') from exc

if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='0.0.0.0', port=int(os.getenv('PORT', 5006)))