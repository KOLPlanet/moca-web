export type NewsItem = {
  title: string;
  category: string;
  excerpt: string;
  image: string;
  date: string;
};

export const newsItems: NewsItem[] = [
  {
    title:
      'Indonesia’s 50% Platform Fee Cut Excludes Cross-Border Sellers: What Changed in June 2026',
    category: 'E-commerce · Indonesia',
    excerpt:
      'A concise look at the new platform-fee policy, who qualifies, and what it means for cross-border sellers.',
    image: '/images/news/indonesia-platform-fee.png',
    date: '2026-07-02',
  },
  {
    title:
      'Q1 2026 Cross-Border Ad Pricing Report: A K-Shaped Split Across Four Social Platforms',
    category: 'Digital Advertising',
    excerpt:
      'How pricing diverged across major social platforms, and the signals international advertisers should watch.',
    image: '/images/news/q1-ad-pricing.png',
    date: '2026-05-28',
  },
  {
    title:
      'TikTok’s New Rules Force Search-First Shift in Southeast Asia',
    category: 'Influencer Marketing',
    excerpt:
      'Why search capability, content quality, and brand trust are becoming central to regional growth.',
    image: '/images/news/tiktok-search.png',
    date: '2026-05-20',
  },
  {
    title:
      'World Cup 2026: How Challenger Brands Win the Second Screen',
    category: 'Marketing Strategy',
    excerpt:
      'A framework for connecting live moments, creators, and mobile audiences across Southeast Asia and India.',
    image: '/images/news/world-cup.png',
    date: '2026-05-10',
  },
  {
    title: 'From Viral Hits to Search-First: TikTok Shop Is Rewriting the Rules',
    category: 'Social Commerce',
    excerpt:
      'The playbook is moving from short-lived spikes toward discoverability, consistency, and measurable trust.',
    image: '/images/news/tiktok-shop.jpg',
    date: '2026-04-23',
  },
];
