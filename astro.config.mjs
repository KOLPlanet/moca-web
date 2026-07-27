import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import vercel from '@astrojs/vercel';
import { loadEnv } from 'vite';

const mode = process.env.NODE_ENV === 'development' ? 'development' : 'production';
const env = loadEnv(mode, process.cwd(), '');
const deployTarget = env.DEPLOY_TARGET || 'node';
const isStaticTarget = ['github-pages', 'cloudflare-pages'].includes(deployTarget);

// Static hosts cannot run Astro API routes. Vercel and self-hosted deployments
// retain SSR; Cloudflare Pages supplies its contact API through /functions.
const adapter = isStaticTarget
  ? undefined
  : process.env.VERCEL
    ? vercel()
    : node({ mode: 'standalone' });

export default defineConfig({
  site: env.PUBLIC_SITE_URL || 'http://localhost:4321',
  output: isStaticTarget ? 'static' : 'server',
  adapter:vercel({
    webAnalytics: {
      enabled: true, // set to false when using @vercel/analytics@1.4.0
    },
  }),
});
