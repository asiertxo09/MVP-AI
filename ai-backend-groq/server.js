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
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import googleTTS from 'google-tts-api';
import swaggerUi from 'swagger-ui-express';
import { OpenAPIRegistry, OpenAPIGeneratorV3 } from '@asteasolutions/zod-to-openapi';

const app = express();
app.use(express.json());
app.use(cors({ origin: true })); // en prod: { origin: 'https://tu-dominio' }
app.use(rateLimit({ windowMs: 60_000, max: 60 }));

// Catálogos y almacenamiento en memoria
const TOPICS = ['animales', 'colores', 'números', 'formas'];
const ALLOWED_STYLES = ['dibujos animados', 'goma de borrar', 'pegatina brillante'];
const BANNED_TOPICS = ['violencia', 'armas', 'drogas'];
const sessions = new Map();
const events = [];

// OpenAPI registry
const registry = new OpenAPIRegistry();

function contentFilter(req, res, next){
    const txt = (req.body?.prompt || req.body?.text || '').toString().toLowerCase();
    const blocked = BANNED_TOPICS.find(t => txt.includes(t));
    if (blocked) return res.status(400).json({ error: 'Tema no apto para niños' });
    next();
}

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
const BodySchema = z.object({ prompt: z.string().min(1).max(5000), level: z.number().min(1).max(5).optional(), lang: z.string().optional() });
const ImageSchema = z.object({ prompt: z.string().min(1).max(200), style: z.string().min(0).max(100).optional() });
const AudioSchema = z.object({ audio: z.string().min(1) }); // audio base64
const SessionSchema = z.object({ age: z.number().int().min(5).max(8).optional(), interests: z.array(z.string()).optional(), level: z.number().min(1).max(5).optional() });
const LessonStartSchema = z.object({ sessionId: z.string(), topic: z.string().optional() });
const LessonAnswerSchema = z.object({ sessionId: z.string(), lessonId: z.string(), answer: z.string().min(1), hintsUsed: z.number().int().min(0).optional() });
const RewardSchema = z.object({ sessionId: z.string() });
const SpeakSchema = z.object({ text: z.string().min(1), lang: z.string().min(2).max(5).optional() });
const EventSchema = z.object({ sessionId: z.string(), type: z.string().min(1), details: z.any().optional() });

// Registro OpenAPI
registry.registerPath({ method: 'post', path: '/api/generate', request: { body: { content: { 'application/json': { schema: BodySchema } } } }, responses: { 200: { description: 'Texto generado' } } });
registry.registerPath({ method: 'post', path: '/api/session', request: { body: { content: { 'application/json': { schema: SessionSchema } } } }, responses: { 200: { description: 'Sesión creada' } } });
registry.registerPath({ method: 'post', path: '/api/lesson/start', request: { body: { content: { 'application/json': { schema: LessonStartSchema } } } }, responses: { 200: { description: 'Lección' } } });
registry.registerPath({ method: 'post', path: '/api/lesson/answer', request: { body: { content: { 'application/json': { schema: LessonAnswerSchema } } } }, responses: { 200: { description: 'Evaluación' } } });
registry.registerPath({ method: 'post', path: '/api/reward/claim', request: { body: { content: { 'application/json': { schema: RewardSchema } } } }, responses: { 200: { description: 'Recompensa' } } });
registry.registerPath({ method: 'post', path: '/api/image', request: { body: { content: { 'application/json': { schema: ImageSchema } } } }, responses: { 200: { description: 'Imagen' } } });
registry.registerPath({ method: 'post', path: '/api/speak', request: { body: { content: { 'application/json': { schema: SpeakSchema } } } }, responses: { 200: { description: 'Audio' } } });

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
app.post('/api/generate', contentFilter, async (req,res)=>{
    try {
        const { prompt, level = 1, lang = 'es' } = BodySchema.parse(req.body);
        const completion = await groq.chat.completions.create({
            model: 'openai/gpt-oss-20b', temperature: 0.7, max_tokens: 200,
            messages: [
                { role: 'system', content: `Eres un tutor infantil amable (5-10 años). Responde en 1-2 frases, lenguaje sencillo y positivo, emojis opcionales. Idioma: ${lang}` },
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

// === Gestión de sesiones ===
app.post('/api/session', (req,res)=>{
    const { age = 5, interests = [], level = 1 } = SessionSchema.parse(req.body || {});
    const sessionId = uuidv4();
    sessions.set(sessionId, { profile: { age, interests, level }, lessons: [], stickers: 0, history: [], responseTimes: [] });
    res.json({ sessionId, profile: { age, interests, level } });
});

// === Inicio de lección ===
app.post('/api/lesson/start', contentFilter, (req,res)=>{
    const { sessionId, topic } = LessonStartSchema.parse(req.body);
    const session = sessions.get(sessionId);
    if (!session) return res.status(404).json({ error: 'Sesión no encontrada' });
    const chosen = topic && TOPICS.includes(topic) ? topic : TOPICS[Math.floor(Math.random()*TOPICS.length)];
    const lessonId = uuidv4();
    const prompt = `Tema ${chosen}. Nivel ${session.profile.level}. Crea una consigna corta para un niño.`;
    session.lessons.push({ id: lessonId, topic: chosen, expected: chosen, start: Date.now(), hintsUsed: 0 });
    res.json({ lessonId, consigna: `Hablemos de ${chosen}!`, hint: `Piensa en ${chosen}.`, next_hint_available_in: 5, stars_earned: 0, has_more_hints: true });
});

// === Respuesta de lección ===
app.post('/api/lesson/answer', (req,res)=>{
    const { sessionId, lessonId, answer, hintsUsed = 0 } = LessonAnswerSchema.parse(req.body);
    const session = sessions.get(sessionId);
    if (!session) return res.status(404).json({ error: 'Sesión no encontrada' });
    const lesson = session.lessons.find(l=>l.id===lessonId);
    if (!lesson) return res.status(404).json({ error: 'Lección no encontrada' });
    const correct = answer.trim().toLowerCase().includes(lesson.expected);
    lesson.answered = true; lesson.correct = correct; lesson.hintsUsed = hintsUsed;
    const stars = correct ? 1 : 0;
    session.stickers += stars;
    session.history.push(correct);
    if (session.history.length>5) session.history.shift();
    const rt = Date.now()-lesson.start;
    session.responseTimes.push(rt);
    if (session.responseTimes.length>5) session.responseTimes.shift();
    const acc = session.history.filter(Boolean).length;
    if (session.history.length===5){
        if (acc>=4 && session.profile.level<5) session.profile.level++;
        if (acc<=2 && session.profile.level>1) session.profile.level--;
    }
    res.json({ correct, feedback: correct? '¡Lo lograste, explorador de números!' : 'Sigue intentando, valiente aventurero!', stars_earned: stars, next_hint_available_in: correct?0:5 });
});

// === Recompensas ===
app.post('/api/reward/claim', async (req,res)=>{
    try {
        const { sessionId } = RewardSchema.parse(req.body);
        const session = sessions.get(sessionId);
        if (!session) return res.status(404).json({ error: 'Sesión no encontrada' });
        if (session.stickers <=0) return res.status(400).json({ error: 'Sin pegatinas suficientes' });
        const { buffer } = await generateImageUnified('colorida pegatina infantil');
        session.stickers--;
        res.set('Content-Type','image/png');
        res.send(buffer);
    } catch(err){
        console.error('Error en /api/reward/claim:', err.message);
        res.status(500).json({ error: 'Reward failed' });
    }
});

// === Eventos ===
app.post('/api/events', (req,res)=>{
    const { sessionId, type, details } = EventSchema.parse(req.body);
    events.push({ sessionId, type, details, ts: Date.now() });
    res.json({ ok: true });
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
        if (style && !ALLOWED_STYLES.includes(style)) return res.status(400).json({ error: 'Estilo no permitido' });
        const combined = style ? `${prompt}, estilo ${style}` : prompt;
        const { buffer, model, fromCache, source } = await generateImageUnified(combined);
        const etag = crypto.createHash('sha1').update(buffer).digest('hex');
        if (req.headers['if-none-match'] === etag) return res.status(304).end();
        res.set('ETag', etag);
        res.set('Cache-Control', 'public, max-age=3600');
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
    if (style && !ALLOWED_STYLES.includes(style)) return res.status(400).json({ error: 'Estilo no permitido' });
    try {
        const combined = style ? `${prompt}, estilo ${style}` : prompt;
        const { buffer, model, fromCache, source } = await generateImageUnified(combined);
        const etag = crypto.createHash('sha1').update(buffer).digest('hex');
        if (req.headers['if-none-match'] === etag) return res.status(304).end();
        res.set('ETag', etag);
        res.set('Cache-Control', 'public, max-age=3600');
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

// === Síntesis de voz ===
app.post('/api/speak', async (req,res,next)=>{
    try {
        const { text, lang = 'es' } = SpeakSchema.parse(req.body);
        const url = googleTTS.getAudioUrl(text, { lang, slow: false });
        const r = await fetch(url);
        const buf = Buffer.from(await r.arrayBuffer());
        res.set('Content-Type','audio/mpeg');
        res.send(buf);
    } catch(err){
        next(err);
    }
});

// === Documentación OpenAPI ===
const generator = new OpenAPIGeneratorV3(registry.definitions, '3.0.0');
const openApiDoc = generator.generateDocument({ info: { title: 'AI Backend', version: '1.0.0' } });
app.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiDoc));

// === Manejo de errores ===
app.use((err, _req, res, _next)=>{
    console.error('Error no controlado:', err.message);
    res.status(500).json({ error: 'Internal server error' });
});

const port = process.env.PORT || 3001;
app.listen(port, () => console.log(`✅ AI backend (Groq) escuchando en puerto ${port}`));
