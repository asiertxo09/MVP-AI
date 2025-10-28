import 'dotenv/config';

if (typeof fetch === 'undefined') {
  const { default: fetchFn } = await import('node-fetch');
  globalThis.fetch = fetchFn;
  console.log('[INIT] node-fetch polyfill enabled');
}

import { createApp } from './src/app.js';

const { app, config } = createApp();
const port = config.port;

app.listen(port, () => {
  console.log(`✅ AI backend (Groq) listening on port ${port}`);
});
