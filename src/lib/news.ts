import type { CollectionEntry } from 'astro:content';

export const NEWS_PAGE_SIZE = 10;

export type NewsEntry = CollectionEntry<'news'>;
export type TaxonomyKey = 'categories' | 'tags';

export type TaxonomySummary = {
  name: string;
  slug: string;
  count: number;
};

const WORDS_PER_MINUTE = 220;

function normalizeReadingText(value: string) {
  return value
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[#>*_`~|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function getEstimatedReadingMinutes(entry: NewsEntry) {
  const source =
    typeof entry.body === 'string' && entry.body.trim()
      ? entry.body
      : `${entry.data.summary} ${entry.data.description}`;
  const text = normalizeReadingText(source);
  const cjkCharacters =
    text.match(
      /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu,
    )?.length || 0;
  const latinText = text.replace(
    /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu,
    ' ',
  );
  const words =
    latinText.match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu)?.length || 0;
  const equivalentWords = words + cjkCharacters / 2.5;

  return Math.max(1, Math.ceil(equivalentWords / WORDS_PER_MINUTE));
}

export function sortNewsEntries(entries: NewsEntry[]) {
  return [...entries].sort(
    (a, b) => b.data.publishedAt.valueOf() - a.data.publishedAt.valueOf(),
  );
}

export function paginateNews(
  entries: NewsEntry[],
  currentPage: number,
  pageSize = NEWS_PAGE_SIZE,
) {
  const totalPages = Math.max(1, Math.ceil(entries.length / pageSize));
  const page = Math.min(Math.max(1, currentPage), totalPages);
  const start = (page - 1) * pageSize;

  return {
    entries: entries.slice(start, start + pageSize),
    currentPage: page,
    totalPages,
    totalEntries: entries.length,
  };
}

export function getTaxonomySummaries(
  entries: NewsEntry[],
  key: TaxonomyKey,
) {
  const summaries = new Map<string, TaxonomySummary>();

  for (const entry of entries) {
    const seen = new Set<string>();

    for (const item of entry.data[key]) {
      if (seen.has(item.slug)) continue;
      seen.add(item.slug);

      const existing = summaries.get(item.slug);
      summaries.set(item.slug, {
        name: existing?.name || item.name,
        slug: item.slug,
        count: (existing?.count || 0) + 1,
      });
    }
  }

  return [...summaries.values()].sort(
    (a, b) =>
      b.count - a.count ||
      a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }),
  );
}

export function sortTaxonomyItemsByCount<
  T extends { name: string; slug: string },
>(items: readonly T[], counts: Record<string, number>) {
  return [...items].sort(
    (a, b) =>
      (counts[b.slug] || 0) - (counts[a.slug] || 0) ||
      a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }),
  );
}

export function filterNewsByTaxonomy(
  entries: NewsEntry[],
  key: TaxonomyKey,
  slug: string,
) {
  return entries.filter((entry) =>
    entry.data[key].some((item) => item.slug === slug),
  );
}

export function getTaxonomyLabel(
  entries: NewsEntry[],
  key: TaxonomyKey,
  slug: string,
) {
  return entries
    .flatMap((entry) => entry.data[key])
    .find((item) => item.slug === slug)?.name;
}

export function getArchivePageHref(basePath: string, page: number) {
  return page <= 1 ? basePath : `${basePath}/page/${page}`;
}

export function getTaxonomyCountMap(
  entries: NewsEntry[],
  key: TaxonomyKey,
) {
  return Object.fromEntries(
    getTaxonomySummaries(entries, key).map(({ slug, count }) => [slug, count]),
  );
}
