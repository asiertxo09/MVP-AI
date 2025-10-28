import io
import os
import time
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field
from PIL import Image
import torch
from diffusers import StableDiffusionXLPipeline

SERVICE_NAME = 'sdxl-service'

app = FastAPI(title='Local SDXL Inference', version='1.0.0')

MODEL_ID = os.getenv('LOCAL_SDXL_MODEL', 'stabilityai/stable-diffusion-xl-base-1.0')
DEVICE = 'cuda' if torch.cuda.is_available() else 'cpu'
TORCH_DTYPE = torch.float16 if DEVICE == 'cuda' else torch.float32
_pipe: Optional[StableDiffusionXLPipeline] = None


class ImageRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=400)
    negative_prompt: Optional[str] = Field(default=None, max_length=200)
    style: Optional[str] = Field(default=None, max_length=120)
    steps: int = Field(default=30, ge=10, le=60)
    guidance: float = Field(default=7.5, ge=1.0, le=15.0)
    seed: Optional[int] = Field(default=None)

    def normalized_prompt(self) -> str:
        prompt = self.prompt.strip()
        if self.style:
            prompt = f"{prompt}, estilo {self.style.strip()}"
        return prompt

    def normalized_negative(self) -> Optional[str]:
        return self.negative_prompt.strip() if self.negative_prompt else None


def get_pipeline() -> StableDiffusionXLPipeline:
    global _pipe
    if _pipe is None:
        start = time.time()
        _pipe = StableDiffusionXLPipeline.from_pretrained(
            MODEL_ID,
            torch_dtype=TORCH_DTYPE,
            use_safetensors=True,
        )
        _pipe.to(DEVICE)
        if DEVICE == 'cuda':
            _pipe.enable_attention_slicing()
            try:
                _pipe.enable_vae_tiling()
            except Exception:
                pass
        load_ms = int((time.time() - start) * 1000)
        print(f"[SDXL][Init] Modelo '{MODEL_ID}' cargado en {load_ms} ms (device={DEVICE})")
    return _pipe


@app.get('/health/live')
async def health_live():
    return {'ok': True, 'service': SERVICE_NAME, 'status': 'live'}


@app.get('/health/ready')
async def health_ready():
    ready = _pipe is not None
    return {
        'ok': ready,
        'service': SERVICE_NAME,
        'status': 'ready' if ready else 'cold',
        'model': MODEL_ID,
        'device': DEVICE,
    }


@app.get('/health')
async def health():
    return {
        'ok': True,
        'service': SERVICE_NAME,
        'model': MODEL_ID,
        'device': DEVICE,
    }


@app.post('/image')
async def generate_image(payload: ImageRequest):
    if not payload.prompt.strip():
        raise HTTPException(status_code=400, detail='Prompt vacío')

    pipe = get_pipeline()
    generator = None
    if payload.seed is not None:
        generator = torch.Generator(device=DEVICE).manual_seed(payload.seed)

    try:
        start = time.time()
        result = pipe(
            prompt=payload.normalized_prompt(),
            negative_prompt=payload.normalized_negative(),
            num_inference_steps=payload.steps,
            guidance_scale=payload.guidance,
            generator=generator,
        )
        image: Image.Image = result.images[0]
        buffer = io.BytesIO()
        image.save(buffer, format='PNG')
        data = buffer.getvalue()
        elapsed = int((time.time() - start) * 1000)
        print(
            f"[SDXL][Local] prompt='{payload.prompt[:60]}' style='{payload.style or '-'}' bytes={len(data)} ms={elapsed}"
        )
        headers = {
            'X-Image-Model': MODEL_ID,
            'X-Image-Source': 'local',
            'X-Image-Cache': 'miss',
        }
        return Response(content=data, media_type='image/png', headers=headers)
    except Exception as exc:  # noqa: BLE001
        print('[SDXL][Error]', exc)
        raise HTTPException(status_code=500, detail=str(exc)) from exc


if __name__ == '__main__':
    import uvicorn

    uvicorn.run(app, host='0.0.0.0', port=int(os.getenv('PORT', 5005)))
