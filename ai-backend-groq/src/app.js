import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import Groq from 'groq-sdk';
import { z, ZodError } from 'zod';
import { ServiceError } from './errors.js';
import { loadConfig } from './config.js';
import { createHttpClient } from './http-client.js';

const generateSchema = z.object({
  prompt: z.string().min(1).max(5_000),
  level: z.number().min(1).max(5).optional().default(1),
});

const imageSchema = z.object({
  prompt: z.string().min(1).max(300),
  style: z.string().trim().min(1).max(120).optional(),
});

const transcribeSchema = z.object({
  audio: z.string().min(10),
  format: z.enum(['wav', 'mp3', 'ogg', 'm4a', 'webm']).optional().default('wav'),
  language: z.string().min(2).max(10).optional(),
});

function buildCorsOptions(allowedOrigins) {
  return {
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }
      if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new ServiceError(`Origin ${origin} is not allowed`, 403));
    },
    credentials: true,
    optionsSuccessStatus: 204,
  };
}

function extractText(completion) {
  const choice = completion?.choices?.[0];
  if (!choice) return '';
  if (typeof choice?.message?.content === 'string') {
    return choice.message.content.trim();
  }
  if (typeof choice?.text === 'string') {
    return choice.text.trim();
  }
  const parts = choice?.message?.content;
  if (Array.isArray(parts)) {
    const joined = parts
      .map((part) => (typeof part === 'string' ? part : part?.text || ''))
      .join('')
      .trim();
    if (joined) return joined;
  }
  return '';
}

async function generateImage(prompt, config, httpClient) {
  if (config.localSdxlUrl) {
    try {
      const buffer = await httpClient.postBinary(config.localSdxlUrl || '', { prompt }, {
        headers: { Accept: 'image/png' },
      });
      return { buffer, model: 'local-sdxl', source: 'local', fromCache: false };
    } catch (error) {
      console.error('[SDXL][Local] Fallback to HF due to error:', error.message);
    }
  }

  if (!config.hfApiKey) {
    throw new ServiceError('Hugging Face API key not configured and LOCAL_SDXL_URL unavailable', 503);
  }

  const model = config.hfImageModels[0];
  const url = `https://api-inference.huggingface.co/models/${model}`;
  const buffer = await httpClient.postBinary(
    url,
    { inputs: prompt },
    {
      headers: {
        Authorization: `Bearer ${config.hfApiKey}`,
        Accept: 'image/png',
      },
      timeoutMs: 30_000,
    },
  );
  return { buffer, model, source: 'huggingface', fromCache: false };
}

async function transcribeAudio(payload, config, httpClient) {
  if (!config.localAsrUrl) {
    throw new ServiceError('LOCAL_ASR_URL is not configured', 503);
  }
  return httpClient.postJson(config.localAsrUrl, payload, { timeoutMs: 60_000 });
}

export function createApp(options = {}) {
  const config = loadConfig(options.env ?? process.env);
  const app = express();
  const groqClient = options.groqClient ?? new Groq({ apiKey: config.groqApiKey });
  const httpClient = options.httpClient ?? createHttpClient(options.fetchImpl);

  app.set('trust proxy', 1);
  app.use(express.json({ limit: '15mb' }));
  app.use(cors(buildCorsOptions(config.allowedOrigins)));
  app.use(
    rateLimit({
      windowMs: config.rateLimit.windowMs,
      limit: config.rateLimit.max,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
    }),
  );

  app.get('/favicon.ico', (_req, res) => res.status(204).end());
  app.get('/health/live', (_req, res) => {
    res.json({ ok: true, service: 'ai-backend-groq', status: 'live' });
  });
  app.get('/health/ready', (_req, res) => {
    res.json({
      ok: true,
      service: 'ai-backend-groq',
      status: 'ready',
      dependencies: {
        groq: Boolean(config.groqApiKey),
        image: Boolean(config.localSdxlUrl || config.hfApiKey),
        asr: Boolean(config.localAsrUrl),
        tts: Boolean(config.localTtsUrl),
      },
    });
  });
  app.get('/health', (_req, res) => {
    res.json({
      ok: true,
      service: 'ai-backend-groq',
      uptime: process.uptime(),
    });
  });

  app.get('/api/generate', (_req, res) => {
    res.status(405).json({ error: 'Use POST /api/generate' });
  });

  app.post('/api/generate', async (req, res, next) => {
    try {
      if (!config.groqApiKey) {
        throw new ServiceError('GROQ_API_KEY is not configured', 503);
      }
      const { prompt, level } = generateSchema.parse(req.body);
      const completion = await groqClient.chat.completions.create({
        model: 'openai/gpt-oss-20b',
        temperature: 0.7,
        max_tokens: 200,
        messages: [
          {
            role: 'system',
            content:
              'Eres un tutor infantil amable (5-10 años). Responde en 1-2 frases, lenguaje sencillo y positivo, emojis opcionales.',
          },
          { role: 'user', content: `Nivel ${level}. Genera una pista o refuerzo breve: ${prompt}` },
        ],
      });
      const text = extractText(completion) || '👀 Intenta contar paso a paso, ¡tú puedes!';
      res.json({ text });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/image', async (req, res, next) => {
    try {
      const { prompt, style } = imageSchema.parse(req.body);
      const combinedPrompt = style ? `${prompt}, estilo ${style}` : prompt;
      const { buffer, model, source, fromCache } = await generateImage(combinedPrompt, config, httpClient);
      res.setHeader('Content-Type', 'image/png');
      if (model) res.setHeader('X-Image-Model', model);
      if (source) res.setHeader('X-Image-Source', source);
      res.setHeader('X-Image-Cache', fromCache ? 'hit' : 'miss');
      res.send(buffer);
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/transcribe', async (req, res, next) => {
    try {
      const payload = transcribeSchema.parse(req.body);
      const response = await transcribeAudio(payload, config, httpClient);
      res.json(response);
    } catch (error) {
      next(error);
    }
  });

  app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  app.use((err, req, res, _next) => {
    if (err instanceof ServiceError) {
      res.status(err.status).json({ error: err.message, details: err.details || undefined });
      return;
    }
    if (err instanceof ZodError) {
      res.status(400).json({ error: 'Validation error', details: err.flatten() });
      return;
    }
    if (err?.message && /CORS/.test(err.message)) {
      res.status(403).json({ error: err.message });
      return;
    }
    console.error('Unexpected error', err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return { app, config };
}
