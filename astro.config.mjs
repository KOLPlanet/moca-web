import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import { loadEnv } from 'vite';

const mode = process.env.NODE_ENV === 'development' ? 'development' : 'production';
const env = loadEnv(mode, process.cwd(), '');

export default defineConfig({
  site: env.PUBLIC_SITE_URL || 'http://localhost:4321',
  output: 'server',
  adapter: node({
    mode: 'standalone',
  }),
});
