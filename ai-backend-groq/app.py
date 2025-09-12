import os
import io
import re
import requests
from flask import Flask, request, send_file, jsonify
from flask_cors import CORS
try:
    from dotenv import load_dotenv, find_dotenv
    load_dotenv(find_dotenv())
except Exception:
    pass

app = Flask(__name__)
CORS(app)

BAD_WORDS = {"blood", "violence", "kill", "matar", "weapon", "gun", "adult", "nude", "drug", "drugs", "sex"}

# Helpers
def _clean_env(v: str) -> str:
    return re.sub(r'^["\']+|["\']+$', '', (v or '').strip())

def _extract_groq_text(payload: dict) -> str:
    try:
        choices = payload.get("choices") or []
        ch = choices[0] if choices else {}
        msg = ch.get("message") or {}
        # Primary: chat content
        text = (msg.get("content") or "").strip()
        # Fallback: text completions
        if not text:
            text = (ch.get("text") or "").strip()
        # Fallback: list parts
        if not text and isinstance(msg.get("content"), list):
            parts = msg.get("content")
            text = ''.join(
                (p.get('text', '') if isinstance(p, dict) else str(p)) for p in parts
            ).strip()
        # Fallback: reasoning (Groq sometimes puts draft here)
        if not text:
            reason = (msg.get('reasoning') or ch.get('reasoning') or '').strip()
            if reason:
                text = reason
        return text
    except Exception:
        return ""

GROQ_API_KEY = _clean_env(os.getenv("GROQ_API_KEY", ""))
HF_API_KEY = _clean_env(os.getenv("HF_API_KEY", os.getenv("HUGGING_FACE_API_KEY", "")))
NODE_IMAGE_URL = _clean_env(os.getenv("NODE_IMAGE_URL", "http://localhost:3001/api/image"))

@app.get("/health")
def health():
    return jsonify({
        "ok": True,
        "service": "ai-backend-groq:flask",
        "hasGroq": bool(GROQ_API_KEY),
        "hasHF": bool(HF_API_KEY),
        "nodeFallback": NODE_IMAGE_URL
    })

def is_safe(text: str) -> bool:
    t = text.lower()
    return not any(b in t for b in BAD_WORDS)

def proxy_node_image(prompt: str, style: str):
    try:
        resp = requests.post(
            NODE_IMAGE_URL,
            json={"prompt": prompt, "style": style},
            headers={"Accept": "image/png"},
            timeout=60,
        )
        resp.raise_for_status()
        # content-type might be image/png
        ct = resp.headers.get("content-type", "")
        if "image" not in ct:
            return None, "Node fallback no devolvió imagen"
        return resp.content, None
    except Exception as e:
        return None, str(e)

@app.post("/image")
def generate_image():
    data = request.get_json() or {}
    prompt = (data.get("prompt") or "").strip()
    style = (data.get("style") or "").strip()
    print(prompt)

    if not prompt:
        return jsonify({"error": "prompt requerido"}), 400

    combined = f"{prompt}, estilo {style}" if style else prompt
    if not is_safe(combined):
        return jsonify({"error": "Contenido no permitido"}), 400

    # Prompt augmentation via Groq (opcional)
    aug_prompt = combined
    if GROQ_API_KEY:
        try:
            groq_prompt = (
                "Convierte este texto en un prompt amable, colorido y seguro para un generador de "
                "imágenes infantil. Usa máximo una frase. Responde UNICAMENTE con el prompt final sin explicaciones. Texto: "
                f"{combined}"
            )
            gresp = requests.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {GROQ_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "openai/gpt-oss-20b",
                    "messages": [
                        {"role": "system", "content": "Eres un generador de prompts seguro para niños. Devuelve solo una frase simple apta para un generador de imágenes."},
                        {"role": "user", "content": groq_prompt},
                    ],
                    "max_tokens": 160,
                    "temperature": 0.6,
                },
                timeout=30,
            )

            gresp.raise_for_status()
            payload = gresp.json()
            print(payload)
            extracted = _extract_groq_text(payload)
            if extracted:
                aug_prompt = extracted.strip()
            # Fallback if Groq returned empty/garbled
            if not aug_prompt or len(aug_prompt) < 4:
                aug_prompt = combined
            print("augmented prompt:", aug_prompt)
        except Exception as e:
            print("[Flask][Groq] error", e)
            aug_prompt = combined

    # If HF key missing, try Node fallback instead of 503
    print(aug_prompt)
    if not HF_API_KEY:
        img, err = proxy_node_image(prompt, style)
        if img:
            return send_file(io.BytesIO(img), mimetype="image/png")
        return jsonify({"error": "HF_API_KEY no configurada", "fallback_error": err}), 503

    # Call Hugging Face for Stable Diffusion XL
    try:
        hf_resp = requests.post(
            "https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0",
            headers={
                "Authorization": f"Bearer {HF_API_KEY}",
                "Accept": "image/png",
            },
            json={"inputs": aug_prompt},
            timeout=60,
        )
        hf_resp.raise_for_status()
        return send_file(io.BytesIO(hf_resp.content), mimetype="image/png")
    except Exception as e:
        print("[Flask][HF] error", e)
        # Fallback to Node if HF fails
        img, err = proxy_node_image(prompt, style)
        if img:
            return send_file(io.BytesIO(img), mimetype="image/png")
        return jsonify({"error": "Image generation failed", "fallback_error": err}), 500

if __name__ == "__main__":
    port = int(os.getenv("PORT_PYTHON", 5002))
    app.run(host="0.0.0.0", port=port)
