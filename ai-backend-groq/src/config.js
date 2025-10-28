import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3001),
  CORS_ORIGIN: z.string().optional(),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().optional(),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().optional(),
  GROQ_API_KEY: z.string().optional(),
  HF_IMAGE_MODELS: z.string().optional(),
  HUGGING_FACE_API_KEY: z.string().optional(),
  HF_API_KEY: z.string().optional(),
  LOCAL_SDXL_URL: z.string().optional(),
  LOCAL_ASR_URL: z.string().optional(),
  LOCAL_TTS_URL: z.string().optional(),
});

function splitList(value, fallback = []) {
  if (!value) return fallback;
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeUrl(value) {
  if (!value) return '';
  return value.replace(/\/$/, '');
}

export function loadConfig(rawEnv = process.env) {
  const env = envSchema.parse(rawEnv);
  const corsOrigins = splitList(env.CORS_ORIGIN, [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ]);

  const hfKey = (env.HUGGING_FACE_API_KEY || env.HF_API_KEY || '').trim().replace(/^["']+|["']+$/g, '');
  const hfImageModels = splitList(env.HF_IMAGE_MODELS, ['stabilityai/stable-diffusion-xl-base-1.0']);

  return {
    port: env.PORT,
    allowedOrigins: corsOrigins,
    rateLimit: {
      windowMs: env.RATE_LIMIT_WINDOW_MS ?? 60_000,
      max: env.RATE_LIMIT_MAX ?? 60,
    },
    groqApiKey: env.GROQ_API_KEY?.trim() || '',
    hfApiKey: hfKey,
    hfImageModels,
    localSdxlUrl: normalizeUrl(env.LOCAL_SDXL_URL || ''),
    localAsrUrl: normalizeUrl(env.LOCAL_ASR_URL || ''),
    localTtsUrl: normalizeUrl(env.LOCAL_TTS_URL || ''),
  };
}
