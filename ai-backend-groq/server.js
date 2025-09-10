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

const port = process.env.PORT || 3001;
app.listen(port, () => console.log(`✅ AI backend (Groq) escuchando en puerto ${port}`));
