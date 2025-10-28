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
from pydantic import BaseModel, Field
from transformers import pipeline

SERVICE_NAME = 'audio-service'
TARGET_SAMPLE_RATE = 16_000
DEVICE_INDEX = 0 if torch.cuda.is_available() else -1
DTYPE = torch.float16 if torch.cuda.is_available() else torch.float32

ASR_MODEL_ID = os.getenv('LOCAL_ASR_MODEL', 'openai/whisper-small')
TTS_MODEL_ID = os.getenv('LOCAL_TTS_MODEL', 'facebook/mms-tts-es')
DEFAULT_VOICE = os.getenv('LOCAL_TTS_VOICE', 'default')

app = FastAPI(title='Local Audio Service', version='1.0.0')

_asr_pipeline = None
_tts_pipeline = None


class TranscribeRequest(BaseModel):
    audio: str = Field(..., min_length=10)
    format: str = Field('wav', pattern=r'^[a-z0-9]+$')
    language: Optional[str] = Field(default=None, min_length=2, max_length=10)


class TTSRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=600)
    voice: Optional[str] = Field(default=DEFAULT_VOICE, max_length=40)
    speed: float = Field(default=1.0, ge=0.5, le=2.0)


def decode_audio(payload: TranscribeRequest) -> tuple[torch.Tensor, int]:
    try:
        data = base64.b64decode(payload.audio)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail='Audio inválido (base64)') from exc

    buffer = io.BytesIO(data)
    try:
        waveform, sample_rate = sf.read(buffer, dtype='float32')
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail='No se pudo decodificar el audio') from exc

    if waveform.ndim > 1:
        waveform = np.mean(waveform, axis=1)
    tensor = torch.from_numpy(waveform)
    if tensor.ndim == 1:
        tensor = tensor.unsqueeze(0)
    if sample_rate != TARGET_SAMPLE_RATE:
        tensor = torchaudio.functional.resample(tensor, sample_rate, TARGET_SAMPLE_RATE)
        sample_rate = TARGET_SAMPLE_RATE
    tensor = torch.clamp(tensor, -1.0, 1.0)
    return tensor.squeeze(0), sample_rate


def ensure_asr_pipeline():
    global _asr_pipeline
    if _asr_pipeline is None:
        start = time.time()
        _asr_pipeline = pipeline(
            task='automatic-speech-recognition',
            model=ASR_MODEL_ID,
            torch_dtype=DTYPE,
            device=DEVICE_INDEX,
        )
        elapsed = int((time.time() - start) * 1000)
        print(f"[ASR][Init] Modelo '{ASR_MODEL_ID}' listo en {elapsed} ms (device={DEVICE_INDEX})")
    return _asr_pipeline


def ensure_tts_pipeline():
    global _tts_pipeline
    if _tts_pipeline is None:
        start = time.time()
        _tts_pipeline = pipeline(
            task='text-to-speech',
            model=TTS_MODEL_ID,
            torch_dtype=DTYPE,
            device=DEVICE_INDEX,
        )
        elapsed = int((time.time() - start) * 1000)
        print(f"[TTS][Init] Modelo '{TTS_MODEL_ID}' listo en {elapsed} ms (device={DEVICE_INDEX})")
    return _tts_pipeline


@app.get('/health/live')
async def health_live():
    return {'ok': True, 'service': SERVICE_NAME, 'status': 'live'}


@app.get('/health/ready')
async def health_ready():
    return {
        'ok': _asr_pipeline is not None and _tts_pipeline is not None,
        'service': SERVICE_NAME,
        'status': 'ready' if _asr_pipeline and _tts_pipeline else 'cold',
        'models': {'asr': ASR_MODEL_ID, 'tts': TTS_MODEL_ID},
        'device': 'cuda' if torch.cuda.is_available() else 'cpu',
    }


@app.get('/health')
async def health():
    return {
        'ok': True,
        'service': SERVICE_NAME,
        'models': {'asr': ASR_MODEL_ID, 'tts': TTS_MODEL_ID},
        'device': 'cuda' if torch.cuda.is_available() else 'cpu',
    }


@app.post('/transcribe')
async def transcribe(request: TranscribeRequest):
    waveform, sample_rate = decode_audio(request)
    pipe = ensure_asr_pipeline()
    try:
        result = pipe(
            audio=waveform.numpy(),
            sampling_rate=sample_rate,
            generate_kwargs={'language': request.language} if request.language else None,
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    text = (result.get('text') or '').strip()
    confidence = float(result.get('score') or 0.0)
    return {'text': text, 'confidence': confidence}


def apply_speed(tensor: torch.Tensor, sample_rate: int, speed: float) -> tuple[torch.Tensor, int]:
    if abs(speed - 1.0) < 1e-3:
        return tensor, sample_rate
    new_rate = int(sample_rate * speed)
    if new_rate <= 0:
        new_rate = sample_rate
    tensor = torchaudio.functional.resample(tensor.unsqueeze(0), sample_rate, new_rate).squeeze(0)
    return tensor, new_rate


def tensor_to_wav_bytes(tensor: torch.Tensor, sample_rate: int) -> bytes:
    buffer = io.BytesIO()
    torchaudio.save(buffer, tensor.unsqueeze(0), sample_rate, format='wav')
    return buffer.getvalue()


@app.post('/tts')
async def text_to_speech(request: TTSRequest):
    pipe = ensure_tts_pipeline()
    kwargs = {}
    if request.voice and request.voice != DEFAULT_VOICE:
        kwargs['speaker_id'] = request.voice
    try:
        result = pipe(request.text, **kwargs)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    audio_dict = result.get('audio') or {}
    samples = audio_dict.get('samples') or audio_dict.get('array') or audio_dict.get('numpy')
    if samples is None:
        raise HTTPException(status_code=500, detail='El modelo TTS no devolvió audio')

    tensor = torch.tensor(samples, dtype=torch.float32)
    if tensor.ndim > 1:
        tensor = tensor.mean(dim=0)
    sample_rate = int(audio_dict.get('sampling_rate') or TARGET_SAMPLE_RATE)
    tensor, sample_rate = apply_speed(tensor, sample_rate, request.speed)
    if sample_rate != TARGET_SAMPLE_RATE:
        tensor = torchaudio.functional.resample(tensor.unsqueeze(0), sample_rate, TARGET_SAMPLE_RATE).squeeze(0)
        sample_rate = TARGET_SAMPLE_RATE
    tensor = torch.clamp(tensor, -1.0, 1.0)
    audio_bytes = tensor_to_wav_bytes(tensor, sample_rate)
    headers = {'X-Audio-Model': TTS_MODEL_ID, 'X-Audio-Voice': request.voice or DEFAULT_VOICE}
    return Response(content=audio_bytes, media_type='audio/wav', headers=headers)


if __name__ == '__main__':
    import uvicorn

    uvicorn.run(app, host='0.0.0.0', port=int(os.getenv('PORT', 5006)))
