import request from 'supertest';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createApp } from '../src/app.js';

const pngBuffer = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=',
  'base64',
);

describe('AI backend app', () => {
  const groqClient = {
    chat: {
      completions: {
        create: vi.fn(),
      },
    },
  };

  const httpClient = {
    postBinary: vi.fn(),
    postJson: vi.fn(),
  };

  const env = {
    PORT: '3001',
    GROQ_API_KEY: 'test-key',
    CORS_ORIGIN: 'http://localhost:4000',
    HF_API_KEY: 'hf-key',
    HF_IMAGE_MODELS: 'org/model',
    LOCAL_ASR_URL: 'http://audio/transcribe',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exposes readiness health information', async () => {
    const { app } = createApp({ env, groqClient, httpClient });
    const response = await request(app).get('/health/ready');
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      service: 'ai-backend-groq',
      dependencies: {
        groq: true,
        asr: true,
        image: true,
      },
    });
  });

  it('validates prompt payloads', async () => {
    const { app } = createApp({ env, groqClient, httpClient });
    const response = await request(app).post('/api/generate').send({ level: 2 });
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Validation error');
  });

  it('generates text using the Groq client', async () => {
    groqClient.chat.completions.create.mockResolvedValueOnce({
      choices: [{ message: { content: 'Hola!' } }],
    });
    const { app } = createApp({ env, groqClient, httpClient });
    const response = await request(app).post('/api/generate').send({ prompt: 'Suma 2+2' });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ text: 'Hola!' });
    expect(groqClient.chat.completions.create).toHaveBeenCalledTimes(1);
  });

  it('proxys image generation and returns a PNG buffer', async () => {
    httpClient.postBinary.mockResolvedValueOnce(pngBuffer);
    const { app } = createApp({ env, groqClient, httpClient });
    const response = await request(app).post('/api/image').send({ prompt: 'Un gato feliz', style: 'acuarela' });
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toBe('image/png');
    expect(httpClient.postBinary).toHaveBeenCalledTimes(1);
    expect(response.body).toBeInstanceOf(Buffer);
  });

  it('delegates transcription to the local ASR service', async () => {
    httpClient.postJson.mockResolvedValueOnce({ text: 'hola mundo', confidence: 0.91 });
    const { app } = createApp({ env, groqClient, httpClient });
    const audioPayload = 'QUJDREVGR0g=';
    const response = await request(app)
      .post('/api/transcribe')
      .send({ audio: audioPayload, format: 'wav' });
    expect(response.status).toBe(200);
    expect(response.body.text).toBe('hola mundo');
    expect(httpClient.postJson).toHaveBeenCalledWith('http://audio/transcribe', { audio: audioPayload, format: 'wav' }, {
      timeoutMs: 60_000,
    });
  });

  it('returns 503 when transcription service is not configured', async () => {
    const { app } = createApp({ env: { ...env, LOCAL_ASR_URL: '' }, groqClient, httpClient });
    const response = await request(app)
      .post('/api/transcribe')
      .send({ audio: 'QUJDREVGR0g=', format: 'wav' });
    expect(response.status).toBe(503);
    expect(response.body.error).toMatch(/LOCAL_ASR_URL/);
  });
});
