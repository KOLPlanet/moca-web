import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { site } from '../config/site';
import { sortNewsEntries } from '../lib/news';

export const prerender = true;

const LATEST_ARTICLES = 10;

// llms.txt spec: https://llmstxt.org
export const GET: APIRoute = async ({ site: siteUrl }) => {
  const origin = siteUrl || new URL('http://localhost:4321');
  const posts = sortNewsEntries(
    await getCollection('news', ({ data }) => !data.draft),
  ).slice(0, LATEST_ARTICLES);
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
    '## Latest Articles',
    '',
    ...posts.map(
      (post) =>
        `- [${post.data.title}](${new URL(`/news/${post.data.slug}`, origin).href}): ${post.data.description}`,
    ),
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
