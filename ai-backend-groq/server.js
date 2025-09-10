// server.js (v2 robusto)
import 'dotenv/config';
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

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const BodySchema = z.object({
    prompt: z.string().min(1).max(5000), // Aumentado de 500 a 5000 caracteres
    level: z.number().min(1).max(5).optional()
});

// Esquemas para otras rutas
const ImageSchema = z.object({
    prompt: z.string().min(1).max(200)
});

const AudioSchema = z.object({
    audio: z.string().min(1) // audio codificado en base64
});

// Función para extraer texto de distintas formas posibles
function extractText(completion) {
    // 1) chat.completions estilo OpenAI
    const c = completion?.choices?.[0];
    if (c?.message?.content && typeof c.message.content === 'string') {
        return c.message.content.trim();
    }
    // 2) algunas implementaciones devuelven .text
    if (typeof c?.text === 'string' && c.text.trim()) {
        return c.text.trim();
    }
    // 3) a veces content puede venir como array de partes
    const parts = c?.message?.content;
    if (Array.isArray(parts)) {
        const joined = parts
            .map(p => (typeof p === 'string' ? p : p?.text || ''))
            .join('')
            .trim();
        if (joined) return joined;
    }
    return '';
}

app.post('/api/generate', async (req, res) => {
    try {
        const { prompt, level = 1 } = BodySchema.parse(req.body);

        const completion = await groq.chat.completions.create({
            model: 'openai/gpt-oss-20b',
            temperature: 0.7,
            max_tokens: 200,
            messages: [
                {
                    role: 'system',
                    content:
                        'Eres un tutor infantil amable (5-10 años). Responde en 1-2 frases, lenguaje sencillo y positivo, emojis opcionales.'
                },
                {
                    role: 'user',
                    content: `Nivel ${level}. Genera una pista o refuerzo breve: ${prompt}`
                }
            ]
        });

        // 🔎 Ver en terminal cómo viene la respuesta
        console.log('Groq raw completion:', JSON.stringify(completion, null, 2));

        let text = extractText(completion);

        // Fallback para no romper la UI si viene vacío
        if (!text) {
            text = '👀 Intenta contar paso a paso, ¡tú puedes!';
        }

        res.json({ text });
    } catch (err) {
        console.error('Error en /api/generate:', err);
        res.status(400).json({ error: 'Bad request or Groq error' });
    }
});

// Generación de imágenes con Stable Diffusion
app.post('/api/image', async (req, res) => {
    try {
        const { prompt } = ImageSchema.parse(req.body);

        const response = await fetch(
            'https://api-inference.huggingface.co/models/runwayml/stable-diffusion-v1-5',
            {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${process.env.HF_API_KEY}`,
                    'Content-Type': 'application/json',
                    Accept: 'image/png'
                },
                body: JSON.stringify({ inputs: prompt })
            }
        );

        if (!response.ok) {
            const err = await response.text();
            throw new Error(err);
        }

        const buffer = Buffer.from(await response.arrayBuffer());
        res.set('Content-Type', 'image/png');
        res.send(buffer);
    } catch (err) {
        console.error('Error en /api/image:', err);
        res.status(500).json({ error: 'Image generation failed' });
    }
});

// Transcripción de audio con Whisper
app.post('/api/transcribe', async (req, res) => {
    try {
        const { audio } = AudioSchema.parse(req.body);
        const audioBuffer = Buffer.from(audio, 'base64');

        const response = await fetch(
            'https://api-inference.huggingface.co/models/openai/whisper-small',
            {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${process.env.HF_API_KEY}`,
                    'Content-Type': 'audio/webm'
                },
                body: audioBuffer
            }
        );

        if (!response.ok) {
            const err = await response.text();
            throw new Error(err);
        }

        const data = await response.json();
        res.json({ text: data.text || '' });
    } catch (err) {
        console.error('Error en /api/transcribe:', err);
        res.status(500).json({ error: 'Transcription failed' });
    }
});

const port = process.env.PORT || 3001;
app.listen(port, () => console.log(`✅ AI backend (Groq) escuchando en puerto ${port}`));
