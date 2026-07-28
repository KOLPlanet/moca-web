import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import vercel from '@astrojs/vercel';
import partytown from '@astrojs/partytown';
import sitemap from '@astrojs/sitemap';
import { loadEnv } from 'vite';

const mode = process.env.NODE_ENV === 'development' ? 'development' : 'production';
const env = loadEnv(mode, process.cwd(), '');
const deployTarget = env.DEPLOY_TARGET || 'node';
const isStaticTarget = ['github-pages', 'cloudflare-pages'].includes(deployTarget);
const defaultSiteUrl =
  mode === 'development' ? 'http://localhost:4321' : 'https://www.moca-tech.net';

// Static hosts cannot run Astro API routes. Vercel and self-hosted deployments
// retain SSR; Cloudflare Pages supplies its contact API through /functions.
const adapter = isStaticTarget
  ? undefined
  : process.env.VERCEL
    ? vercel({
        webAnalytics: {
          enabled: true,
        },
      })
    : node({ mode: 'standalone' });

export default defineConfig({
  site: env.PUBLIC_SITE_URL || defaultSiteUrl,
  output: isStaticTarget ? 'static' : 'server',
  integrations: [
    sitemap({
      filter: (page) => !new URL(page).pathname.startsWith('/api/'),
    }),
    partytown({
      config: {
        forward: ['dataLayer.push', 'gtag'],
      },
    }),
  ],
  adapter,
});
