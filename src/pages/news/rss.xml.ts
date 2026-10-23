import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { sortNewsEntries } from '../../lib/news';

export const prerender = true;

const RSS_ITEMS = 30;

const escapeXml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

export const GET: APIRoute = async ({ site }) => {
  const origin = site || new URL('http://localhost:4321');
  const posts = sortNewsEntries(
    await getCollection('news', ({ data }) => !data.draft),
  ).slice(0, RSS_ITEMS);
  const feedUrl = new URL('/news/rss.xml', origin).href;

  const items = posts.map(({ data }) => {
    const url = new URL(`/news/${data.slug}`, origin).href;
    return `    <item>
      <title>${escapeXml(data.title)}</title>
      <link>${escapeXml(url)}</link>
      <guid isPermaLink="true">${escapeXml(url)}</guid>
      <pubDate>${data.publishedAt.toUTCString()}</pubDate>
      <description>${escapeXml(data.description)}</description>
    </item>`;
  });

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>MOCA News</title>
    <link>${escapeXml(new URL('/news', origin).href)}</link>
    <description>Influencer marketing, creator campaigns, CTV, e-commerce, and platform policy across Southeast Asia and India.</description>
    <language>en</language>
    <lastBuildDate>${posts[0].data.updatedAt.toUTCString()}</lastBuildDate>
    <atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml" />
${items.join('\n')}
  </channel>
</rss>
`;

  return new Response(body, {
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' },
  });
};
