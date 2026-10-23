import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import vercel from '@astrojs/vercel';
import partytown from '@astrojs/partytown';
import sitemap from '@astrojs/sitemap';
import { loadEnv } from 'vite';
import { newsLastmods, thinTaxonomyPaths } from './src/lib/thin-taxonomy.mjs';

const thinTaxonomy = thinTaxonomyPaths();
const articleLastmods = newsLastmods();

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
      filter: (page) => {
        const path = new URL(page).pathname.replace(/\/$/, '');
        // Thin tag/category archives are noindex (see NewsArchive), so keep them out too.
        return !path.startsWith('/api/') && !thinTaxonomy.has(path);
      },
      // News pages declare canonical URLs without a trailing slash; list them the same way.
      serialize: (item) => {
        const url = new URL(item.url);
        if (url.pathname.startsWith('/news/')) {
          url.pathname = url.pathname.replace(/\/$/, '');
          item.url = url.href;
          const lastmod = articleLastmods.get(url.pathname);
          if (lastmod) item.lastmod = lastmod;
        }
        return item;
      },
    }),
    partytown({
      config: {
        forward: ['dataLayer.push', 'gtag'],
      },
    }),
  ],
  adapter,
});
