// Tag and category archives with fewer articles than this are thin pages:
// they get `noindex, follow` and stay out of the sitemap.
// Plain .mjs so both astro.config.mjs and components can import it.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';

export const THIN_TAXONOMY_MIN = 3;

/** Frontmatter of every non-draft article under the news content folder. */
function readNewsData(newsDir) {
  const articles = [];
  for (const slug of readdirSync(newsDir)) {
    let raw;
    try {
      raw = readFileSync(join(newsDir, slug, 'index.md'), 'utf8');
    } catch {
      continue;
    }
    const data = parse(raw.split(/^---$/m)[1] || '') || {};
    if (!data.draft) articles.push(data);
  }
  return articles;
}

/** Map of article pathname (/news/<slug>) to its last-modified ISO date. */
export function newsLastmods(newsDir = './src/content/news') {
  return new Map(
    readNewsData(newsDir).map((data) => [
      `/news/${data.slug}`,
      new Date(data.updatedAt || data.publishedAt).toISOString(),
    ]),
  );
}

/** Pathnames (no trailing slash) of thin tag and category archives. */
export function thinTaxonomyPaths(newsDir = './src/content/news') {
  const counts = { tag: new Map(), category: new Map() };
  for (const data of readNewsData(newsDir)) {
    for (const [kind, key] of [['tag', 'tags'], ['category', 'categories']]) {
      for (const s of new Set((data[key] || []).map((item) => item.slug))) {
        counts[kind].set(s, (counts[kind].get(s) || 0) + 1);
      }
    }
  }
  const paths = new Set();
  for (const kind of ['tag', 'category']) {
    for (const [s, n] of counts[kind]) {
      if (n < THIN_TAXONOMY_MIN) paths.add(`/news/${kind}/${s}`);
    }
  }
  return paths;
}
