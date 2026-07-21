import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import vercel from '@astrojs/vercel';
import { loadEnv } from 'vite';

const mode = process.env.NODE_ENV === 'development' ? 'development' : 'production';
const env = loadEnv(mode, process.cwd(), '');

// Vercel sets VERCEL=1 during build/deploy; keep Node adapter for local/self-host.
const adapter = process.env.VERCEL ? vercel() : node({ mode: 'standalone' });

export default defineConfig({
  site: env.PUBLIC_SITE_URL || 'http://localhost:4321',
  output: 'server',
  adapter,
});
