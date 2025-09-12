import os
import io
import requests
from flask import Flask, request, send_file, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

BAD_WORDS = {"blood", "violence", "kill", "matar", "weapon", "gun", "adult", "nude", "drug", "drugs", "sex"}

def is_safe(text: str) -> bool:
    t = text.lower()
    return not any(b in t for b in BAD_WORDS)

@app.post("/image")
def generate_image():
    data = request.get_json() or {}
    prompt = data.get("prompt", "").strip()
    style = data.get("style", "").strip()

    if not prompt:
        return jsonify({"error": "prompt requerido"}), 400

    combined = f"{prompt}, estilo {style}" if style else prompt
    if not is_safe(combined):
        return jsonify({"error": "Contenido no permitido"}), 400

    # Prompt augmentation via Groq
    aug_prompt = combined
    try:
        groq_prompt = (
            "Convierte este texto en un prompt amable, colorido y seguro para un generador de "
            "imágenes infantil. Usa máximo una frase. Texto: "
            f"{combined}"
        )
        gresp = requests.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {os.environ['GROQ_API_KEY']}",
                "Content-Type": "application/json",
            },
            json={
                "model": "openai/gpt-oss-20b",
                "messages": [
                    {"role": "system", "content": "Eres un generador de prompts seguro para niños."},
                    {"role": "user", "content": groq_prompt},
                ],
                "max_tokens": 100,
                "temperature": 0.7,
            },
            timeout=30,
        )
        gresp.raise_for_status()
        aug_prompt = gresp.json()["choices"][0]["message"]["content"].strip()
    except Exception as e:
        print("Groq error", e)

    # Call Hugging Face for Stable Diffusion XL
    try:
        hf_resp = requests.post(
            "https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0",
            headers={
                "Authorization": f"Bearer {os.environ['HF_API_KEY']}",
                "Accept": "image/png",
            },
            json={"inputs": aug_prompt},
            timeout=60,
        )
        hf_resp.raise_for_status()
    except Exception as e:
        print("HF error", e)
        return jsonify({"error": "Image generation failed"}), 500

    return send_file(io.BytesIO(hf_resp.content), mimetype="image/png")

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5001))
    app.run(host="0.0.0.0", port=port)
