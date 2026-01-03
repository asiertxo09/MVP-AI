#!/usr/bin/env python3
import os
import argparse
import sys
import time
import requests
import re
import json

# --- CONFIGURATION ---
# Points to your Unified Backend (ai-backend-groq)
# Ensure this matches the port where your FastAPI backend is running (default usually 5001 or 8000)
GROQ_API_URL = os.getenv('GROQ_API_URL', 'http://localhost:5001') 

# Directory to save assets
ASSETS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'frontend', 'assets', 'generated')

# The model to use for SVG coding (Llama 3 or Qwen are best)
DEFAULT_SVG_MODEL = "llama-3.3-70b-versatile"

# --- OPTIONAL IMPORTS FOR PIXEL GENERATION ---
# This allows the script to work even if you don't have the heavy SDXL libraries installed
try:
    from huggingface_hub import hf_hub_download
except ImportError:
    hf_hub_download = None

try:
    from stable_diffusion_cpp import StableDiffusion
except ImportError:
    StableDiffusion = None

def ensure_dir(path):
    if not os.path.exists(path):
        os.makedirs(path)

# --- SVG GENERATION LOGIC (NEW) ---
def generate_svg_with_llm(prompt, output_path):
    print(f"🎨 Generating Premium SVG for: '{prompt}'...")
    print(f"📡 Connecting to Backend at: {GROQ_API_URL}/chat")

    # 1. EJEMPLO MAESTRO
    example_svg = """
    <svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
      <circle cx="256" cy="256" r="240" fill="#6C5CE7"/>
      <path d="M256 496 A240 240 0 0 0 496 256" fill="#000000" opacity="0.1"/>
      <path d="M256 100 L300 200 L410 210 L330 290 L350 400 L256 350 L162 400 L182 290 L102 210 L212 200 Z" fill="#FF9F43" stroke="#FFFFFF" stroke-width="20" stroke-linejoin="round"/>
      <ellipse cx="180" cy="180" rx="40" ry="20" fill="#FFFFFF" opacity="0.3" transform="rotate(-45 180 180)"/>
    </svg>
    """

    # 2. PROMPT DE INGENIERÍA
    system_instruction = (
        "You are a Senior UI Designer specializing in SVG icons for children's apps. "
        "Your goal is to create 'Kawaii', 'Flat', and 'Vibrant' icons.\n\n"
        
        "RULES:"
        "1. CANVAS: Always use viewBox='0 0 512 512'. Center the main subject at (256, 256).\n"
        "2. STYLE: Use 'Geometric Constructivism'. Build complex shapes from simple circles and rounded rectangles.\n"
        "3. PALETTE: Use ONLY these colors: Purple #6C5CE7, Orange #FF9F43, Teal #00D2D3, Green #2ECC71, Red #FF6B6B, White #FFFFFF, Dark #2D3436.\n"
        "4. DEPTH: Add a 'Highlight' (white oval, opacity 0.3) on the top-left and a 'Shadow' (black path, opacity 0.1) on the bottom-right.\n"
        "5. STROKE: Use thick, rounded strokes (stroke-width='16' stroke-linecap='round' stroke-linejoin='round') in darker shades or white.\n"
        "6. OUTPUT: Return ONLY valid XML code within <svg> tags including xmlns.\n\n"

        f"EXAMPLE OF GOOD CODE:\n{example_svg}"
    )

    payload = {
        "model": DEFAULT_SVG_MODEL,
        "messages": [
            {"role": "system", "content": system_instruction},
            {"role": "user", "content": f"Generate a high-quality, cute SVG icon of: {prompt}. Make it fill the canvas properly."}
        ],
        "temperature": 0.2,
        "max_tokens": 4096
    }

    try:
        response = requests.post(f"{GROQ_API_URL}/chat", json=payload)
        
        if response.status_code == 200:
            data = response.json()
            if 'choices' in data:
                content = data['choices'][0]['message']['content']
            elif 'content' in data:
                content = data['content']
            else:
                content = str(data)

            svg_match = re.search(r'(<svg[\s\S]*?</svg>)', content)
            
            if svg_match:
                clean_svg = svg_match.group(1)
                
                # PARCHE DE SEGURIDAD
                if "xmlns=" not in clean_svg:
                    clean_svg = clean_svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"')

                # CORRECCIÓN AQUÍ: Usamos output_path en lugar de output_file
                with open(output_path, 'w') as f:
                    f.write(clean_svg)
                print(f"✅ Premium SVG Saved to: {output_path}")
            else:
                print("⚠️ Error: LLM did not return valid SVG code.")
                print(f"Raw Output: {content[:200]}...") 
        else:
            print(f"❌ API Error {response.status_code}: {response.text}")

    except Exception as e:
        print(f"❌ Connection Failed: {e}")

# --- PIXEL IMAGE LOGIC (OLD/OPTIONAL) ---
def generate_image_sdxl(prompt, output_path, steps=20, style='cinematic'):
    if not StableDiffusion:
        print("❌ Error: 'stable-diffusion-cpp-python' not installed.")
        print("   Use --type svg to generate assets using the LLM instead.")
        return

    print(f"📷 Generating Pixel Image for: '{prompt}'...")
    # ... (Keep your original SDXL logic here if you want, or leave empty)
    # For brevity, I am pointing to the new SVG logic mostly.
    print("   (SDXL generation skipped in this snippet. Install dependencies to enable.)")

# --- MAIN EXECUTION ---
def main():
    parser = argparse.ArgumentParser(description="Generate assets using Groq/LLM (SVG) or Local SDXL (Images).")
    parser.add_argument('prompt', type=str, help="Text description of the asset.")
    parser.add_argument('--type', choices=['image', 'svg'], default='svg', help="Type of asset to generate (default: svg).")
    parser.add_argument('--output', type=str, help="Custom output filename.")
    
    args = parser.parse_args()
    
    ensure_dir(ASSETS_DIR)
    
    # Determine Output Filename
    if args.output:
        filename = args.output
    else:
        slug = args.prompt.lower().replace(' ', '_')[:20]
        ext = 'png' if args.type == 'image' else 'svg'
        filename = f"{slug}_{int(time.time())}.{ext}"
    
    output_path = os.path.join(ASSETS_DIR, filename)

    # --- ROUTING LOGIC ---
    if args.type == 'svg':
        generate_svg_with_llm(args.prompt, output_path)
    else:
        generate_image_sdxl(args.prompt, output_path)

if __name__ == "__main__":
    main()