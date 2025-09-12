// server.js (versión corregida)
import 'dotenv/config';
// Polyfill fetch para Node <18
if (typeof fetch === 'undefined') {
    const { default: fetchFn } = await import('node-fetch');
    globalThis.fetch = fetchFn;
    console.log('[INIT] node-fetch polyfill cargado');
}

import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import Groq from 'groq-sdk';

const app = express();
app.use(express.json());
app.use(cors({ origin: true })); // en prod: { origin: 'https://tu-dominio' }
app.use(rateLimit({ windowMs: 60_000, max: 60 }));

// Salud y ayuda
app.get('/health', (_req, res) => res.json({ ok: true, service: 'ai-backend-groq' }));
app.get('/api/generate', (_req, res) =>
    res.status(405).send('Use POST /api/generate con JSON {prompt, level}')
);
app.get('/favicon.ico', (_req,res)=> res.status(204).end());

// === Configuración Groq + Hugging Face ===
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
let HF_API_KEY = (process.env.HUGGING_FACE_API_KEY || process.env.HF_API_KEY || '').trim().replace(/^['"]+|['"]+$/g,'');
if (HF_API_KEY && /\s/.test(HF_API_KEY)) console.warn('[HF] Warning: API key contiene espacios.');
const HF_IMAGE_MODELS = (process.env.HF_IMAGE_MODELS || 'stabilityai/stable-diffusion-xl-base-1.0')
    .split(',').map(m=>m.trim()).filter(Boolean);
function getHFKey(){ return HF_API_KEY; }
console.log(`[HF] Key detectada: ${HF_API_KEY ? 'sí' : 'no'} (longitud: ${HF_API_KEY ? HF_API_KEY.length : 0})`);
console.log('[HF] Modelos:', HF_IMAGE_MODELS);
const USE_LOCAL_SDXL = !!process.env.LOCAL_SDXL_URL; // ej: http://localhost:5005/sdxl
if (USE_LOCAL_SDXL) console.log('[SDXL][Local] Activado. Endpoint:', process.env.LOCAL_SDXL_URL);

// Debug modelos imagen
app.get('/api/debug/image', (_req,res)=>{
    res.json({ models: HF_IMAGE_MODELS, useLocal: USE_LOCAL_SDXL, hasHFKey: !!HF_API_KEY });
});

// === Schemas ===
const BodySchema = z.object({ prompt: z.string().min(1).max(5000), level: z.number().min(1).max(5).optional() });
const ImageSchema = z.object({ prompt: z.string().min(1).max(200), style: z.string().min(0).max(100).optional() });
const AudioSchema = z.object({ audio: z.string().min(1) }); // audio base64

// === extractText helper ===
function extractText(completion){
    const c = completion?.choices?.[0];
    if (c?.message?.content && typeof c.message.content === 'string') return c.message.content.trim();
    if (typeof c?.text === 'string' && c.text.trim()) return c.text.trim();
    const parts = c?.message?.content;
    if (Array.isArray(parts)) {
        const joined = parts.map(p=> (typeof p==='string'? p : p?.text || '')).join('').trim();
        if (joined) return joined;
    }
    return '';
}

// === Endpoint de texto ===
app.post('/api/generate', async (req,res)=>{
    try {
        const { prompt, level = 1 } = BodySchema.parse(req.body);
        const completion = await groq.chat.completions.create({
            model: 'openai/gpt-oss-20b', temperature: 0.7, max_tokens: 200,
            messages: [
                { role: 'system', content: 'Eres un tutor infantil amable (5-10 años). Responde en 1-2 frases, lenguaje sencillo y positivo, emojis opcionales.'},
                { role: 'user', content: `Nivel ${level}. Genera una pista o refuerzo breve: ${prompt}` }
            ]
        });
        let text = extractText(completion) || '👀 Intenta contar paso a paso, ¡tú puedes!';
        res.json({ text });
    } catch (err){
        console.error('Error en /api/generate:', err.message);
        res.status(400).json({ error: 'Bad request or Groq error' });
    }
});

// === Generación local SDXL ===
async function generateImageLocal(prompt){
    const url = process.env.LOCAL_SDXL_URL; // debe apuntar a /sdxl
    if (!url) throw new Error('LOCAL_SDXL_URL no definido');
    const started = Date.now();
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'image/png' },
        body: JSON.stringify({ prompt })
    });
    if (!res.ok) {
        let text = '';
        try { text = await res.text(); } catch {}
        throw new Error(`Local SDXL error ${res.status}: ${text.slice(0,300)}`);
    }
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('image')) {
        let text = '';
        try { text = await res.text(); } catch {}
        throw new Error(`Local SDXL devolvió non-image (${ct}): ${text.slice(0,300)}`);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    console.log(`[SDXL][Local] OK bytes=${buf.length} ms=${Date.now()-started}`);
    return { buffer: buf, model: 'local-sdxl', fromCache: false, source: 'local' };
}

// Implementación HF para imagen
async function generateImageWithHF(prompt){
    if (!getHFKey()) throw new Error('Hugging Face API key ausente');
    const model = HF_IMAGE_MODELS[0] || 'stabilityai/stable-diffusion-xl-base-1.0';
    const started = Date.now();
    const res = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${getHFKey()}`,
            Accept: 'image/png',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ inputs: prompt })
    });
    if (!res.ok) {
        let text = '';
        try { text = await res.text(); } catch {}
        throw new Error(`HF error ${res.status}: ${text.slice(0,300)}`);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    console.log(`[HF][Image] model=${model} bytes=${buf.length} ms=${Date.now()-started}`);
    return { buffer: buf, model, fromCache: false };
}

// Wrapper unificado
async function generateImageUnified(prompt){
    if (USE_LOCAL_SDXL) {
        try { return await generateImageLocal(prompt); } catch (e){
            console.error('[SDXL][Local] Falla, intentando HF fallback:', e.message);
        }
    }
    const r = await generateImageWithHF(prompt);
    return { ...r, source: 'hf' };
}

// === Endpoints de imagen ===
app.post('/api/image', async (req, res) => {
    try {
        const { prompt, style } = ImageSchema.parse(req.body);
        const combined = style ? `${prompt}, estilo ${style}` : prompt;
        const { buffer, model, fromCache, source } = await generateImageUnified(combined);
        res.set('Content-Type', 'image/png');
        if (model) res.set('X-Image-Model', model);
        if (source) res.set('X-Image-Source', source);
        res.set('X-Image-Cache', fromCache ? 'hit' : 'miss');
        res.send(buffer);
    } catch (err) {
        console.error('Error en /api/image:', err.message);
        res.status(500).json({ error: 'Image generation failed', details: err.message });
    }
});

app.get('/api/image', async (req, res) => {
    const prompt = (req.query.prompt || '').toString();
    const style = (req.query.style || '').toString();
    if (!prompt) return res.status(400).json({ error: 'Falta prompt' });
    try {
        const combined = style ? `${prompt}, estilo ${style}` : prompt;
        const { buffer, model, fromCache, source } = await generateImageUnified(combined);
        res.set('Content-Type', 'image/png');
        if (model) res.set('X-Image-Model', model);
        if (source) res.set('X-Image-Source', source);
        res.set('X-Image-Cache', fromCache ? 'hit' : 'miss');
        res.send(buffer);
    } catch (err) {
        res.status(500).json({ error: 'Image generation failed', details: err.message });
    }
});

// === Transcripción de audio con Whisper ===
app.post('/api/transcribe', async (req, res) => {
    try {
        const { audio } = AudioSchema.parse(req.body);
        const audioBuffer = Buffer.from(audio, 'base64');
        if (!getHFKey()) throw new Error('Hugging Face API key ausente');
        const response = await fetch(
            'https://api-inference.huggingface.co/models/openai/whisper-small',
            {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${getHFKey()}`,
                    'Content-Type': 'audio/webm'
                },
                body: audioBuffer
            }
        );
        if (!response.ok) {
            const err = await response.text();
            throw new Error(`Whisper HF error (${response.status}): ${err}`);
        }
        const data = await response.json();
        res.json({ text: data.text || '' });
    } catch (err) {
        console.error('Error en /api/transcribe:', err.message);
        res.status(500).json({ error: 'Transcription failed', details: err.message });
    }
});

const port = process.env.PORT || 3001;
app.listen(port, () => console.log(`✅ AI backend (Groq) escuchando en puerto ${port}`));
