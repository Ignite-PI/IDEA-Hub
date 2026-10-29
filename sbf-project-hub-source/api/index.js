// Vercel Function entry point: serves every /api/* request with the shared Express app.
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createApp } = require('../server/app.cjs');

const app = createApp();

export default app;
