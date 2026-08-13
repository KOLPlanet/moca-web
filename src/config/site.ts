export const site = {
  name: 'Moca Technology',
  shortName: 'MOCA',
  homeTitle: 'Moca Technology, OEM Consolidator & Ad Innovator',
  description:
    'Founded in 2012, MOCA is an innovative global agency, specializing in user acquisition, influencer marketing, CTV, branding and dynamic programmatic.',
  locale: 'en_US',
  socialImage: {
    src: '/images/og-default.jpg',
    alt: 'MOCA global OEM consolidator & Ad innovator.',
    width: 1200,
    height: 630,
  },
  contact: {
    cooperationEmail: 'business@moca-tech.net',
    careersEmail: 'hr@moca-tech.net',
  },
  legal: {
    privacyPolicyHref: '/privacy-policy',
    icpNumber: '沪ICP备17012977号-1',
    icpHref: 'https://beian.miit.gov.cn/',
    policyUpdatedAt: 'July 20, 2026',
  },
  joinLinks: [
    {
      label: "I'm an Advertiser",
      description: 'Tell us about your campaign',
      href: 'https://link.jiandaoyun.com/f/58aeaf595a9f631d0c7ff82f?ext=mocawebsite',
      type: 'advertiser',
    },
    {
      label: "I'm a Publisher",
      description: 'Explore a media partnership',
      href: 'https://link.jiandaoyun.com/f/58ad3d58a5a10965735fe106?ext=mocawebsite',
      type: 'publisher',
    },
  ],
  socialLinks: [
    {
      label: 'Instagram',
      href: 'https://www.instagram.com/p/DTxtwRJjNyT/',
      icon: 'instagram',
    },
    {
      label: 'LinkedIn',
      href: 'https://www.linkedin.com/company/moca-tech/',
      icon: 'linkedin',
    },
    {
      label: 'WeChat',
      href:
        'https://mp.weixin.qq.com/s?__biz=MzU4MjI5Njk1OQ==&mid=2247484113&idx=1&sn=a0ec3f815c2497b50010edeb6a69f129',
      icon: 'wechat',
    },
    {
      label: 'Xiaohongshu',
      href: 'https://www.xiaohongshu.com/',
      icon: 'xiaohongshu',
    },
  ],
  navigation: [
    { label: 'Core Services', href: '/#services' },
    { label: 'Cases', href: '/#cases' },
    { label: 'About Us', href: '/#about' },
    { label: 'News', href: '/news' },
    { label: 'Contact Us', href: '/#contact' },
  ],
  newsNavigation: [
    { label: 'Core Services', href: '/#services' },
    { label: 'Cases', href: '/#cases' },
    { label: 'About Us', href: '/#about' },
    { label: 'News', href: '/news' },
    { label: 'Contact Us', href: '/#contact' },
  ],
} as const;
