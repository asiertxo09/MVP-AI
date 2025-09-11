import os
import io
import time
from typing import Optional
from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
import torch
from diffusers import StableDiffusionXLPipeline
from PIL import Image

app = FastAPI(title="Local SDXL Inference", version="1.0.0")

MODEL_ID = os.getenv("LOCAL_SDXL_MODEL", "stabilityai/stable-diffusion-xl-base-1.0")
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
TORCH_DTYPE = torch.float16 if DEVICE == "cuda" else torch.float32
_pipe = None

class GenerateRequest(BaseModel):
    prompt: str
    negative_prompt: Optional[str] = None
    steps: Optional[int] = 30
    guidance: Optional[float] = 7.0
    seed: Optional[int] = None


def get_pipe():
    global _pipe
    if _pipe is None:
        t0 = time.time()
        _pipe = StableDiffusionXLPipeline.from_pretrained(
            MODEL_ID,
            torch_dtype=TORCH_DTYPE,
            use_safetensors=True
        )
        # Optimizations
        if DEVICE == "cuda":
            _pipe.to(DEVICE)
            _pipe.enable_attention_slicing()
            try:
                _pipe.enable_vae_tiling()
            except Exception:
                pass
        else:
            _pipe.to(DEVICE)
        load_ms = int((time.time() - t0) * 1000)
        print(f"[SDXL][Init] Modelo cargado '{MODEL_ID}' en {load_ms} ms (device={DEVICE})")
    return _pipe

@app.get("/health")
async def health():
    return {"ok": True, "model": MODEL_ID, "device": DEVICE}

@app.post("/sdxl")
async def generate(req: GenerateRequest):
    if not req.prompt or not req.prompt.strip():
        raise HTTPException(status_code=400, detail="Prompt vacío")
    pipe = get_pipe()
    generator = None
    if req.seed is not None:
        generator = torch.Generator(device=DEVICE).manual_seed(req.seed)
    try:
        t0 = time.time()
        result = pipe(
            prompt=req.prompt.strip(),
            negative_prompt=req.negative_prompt.strip() if req.negative_prompt else None,
            num_inference_steps=min(max(req.steps or 30, 5), 60),
            guidance_scale=min(max(req.guidance or 7.0, 1.0), 15.0),
            generator=generator
        )
        img: Image.Image = result.images[0]
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        data = buf.getvalue()
        ms = int((time.time() - t0) * 1000)
        print(f"[SDXL][Local] prompt='{req.prompt[:60]}' bytes={len(data)} ms={ms}")
        return Response(content=data, media_type="image/png")
    except Exception as e:
        print("[SDXL][Local][Error]", e)
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", 5005)))

