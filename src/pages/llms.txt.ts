import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { site } from '../config/site';
import { getTaxonomySummaries, sortNewsEntries, type NewsEntry } from '../lib/news';

export const prerender = true;

const MAX_ARTICLES = 30;

// Company and corporate announcements (galas, greetings, awards, event recaps) add little for answer engines.
const isCorporate = ({ data }: NewsEntry) =>
  data.categories.some((item) => item.slug === 'company-news') ||
  /^moca\b/i.test(data.title);

// llms.txt spec: https://llmstxt.org
export const GET: APIRoute = async ({ site: siteUrl }) => {
  const origin = siteUrl || new URL('http://localhost:4321');
  const all = sortNewsEntries(
    await getCollection('news', ({ data }) => !data.draft),
  );
  const categories = getTaxonomySummaries(all, 'categories');
  const rankOf = (slug: string) =>
    categories.findIndex((category) => category.slug === slug);
  // An article is listed under its largest category.
  const primary = (entry: NewsEntry) =>
    [...entry.data.categories].sort((a, b) => rankOf(a.slug) - rankOf(b.slug))[0];
  const eligible = all.filter((entry) => !isCorporate(entry));

  // Articles with FAQ or key takeaways first, then fill with the newest of each large category in turn.
  const picked = new Set(
    eligible.filter(({ data }) => data.faq.length > 0 || data.keyTakeaways.length > 0),
  );
  const queues = categories.map((category) =>
    eligible.filter((entry) => primary(entry)?.slug === category.slug),
  );
  while (picked.size < MAX_ARTICLES && queues.some((queue) => queue.length > 0)) {
    for (const queue of queues) {
      while (queue.length > 0 && picked.has(queue[0])) queue.shift();
      if (queue.length > 0 && picked.size < MAX_ARTICLES) picked.add(queue.shift()!);
    }
  }
  const groups = categories
    .map((category) => ({
      name: category.name,
      posts: eligible.filter(
        (entry) => picked.has(entry) && primary(entry)?.slug === category.slug,
      ),
    }))
    .filter((group) => group.posts.length > 0);
  const linkedIn = site.socialLinks.find((link) => link.icon === 'linkedin');

  const body = [
    '# MOCA Technology',
    '',
    '> MOCA Technology is an influencer marketing and programmatic advertising platform founded in 2012, headquartered in Shanghai, with local teams in Jakarta, Bangkok, Manila, and Ho Chi Minh City. MOCA operates KOLPlanet, a creator marketplace serving brands across Indonesia, Thailand, Vietnam, the Philippines, Malaysia, Japan, South Korea, Taiwan, and India.',
    '',
    'MOCA Technology helps brands with Asia-Pacific influencer marketing, KOL strategy, content commerce, and programmatic advertising, specializing in Southeast Asia and India market entry, creator-led campaign execution, and culturally localized brand activation.',
    '',
    '## Core Capabilities',
    '',
    '- Influencer marketing strategy and execution across Southeast Asia and India',
    '- [KOLPlanet](https://www.kolplanet.com): creator marketplace connecting brands with local creators in 9 markets',
    '- Programmatic advertising: cross-platform digital media buying',
    '- Content commerce activation: TikTok Shop, Shopee, Lazada, and Tokopedia campaigns',
    '- Branding solutions for cross-border and local brands',
    '',
    '## Articles',
    '',
    ...groups.flatMap((group) => [
      `### ${group.name}`,
      '',
      ...group.posts.map(
        (post) =>
          `- [${post.data.title}](${new URL(`/news/${post.data.slug}`, origin).href}): ${post.data.description}`,
      ),
      '',
    ]),
    '',
    `All articles: ${new URL('/news', origin).href}`,
    '',
    '## Contact',
    '',
    `- Website: ${new URL('/', origin).href}`,
    '- KOLPlanet: https://www.kolplanet.com',
    `- Email: ${site.contact.cooperationEmail}`,
    ...(linkedIn ? [`- LinkedIn: ${linkedIn.href}`] : []),
    '',
  ].join('\n');

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
