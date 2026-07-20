import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const taxonomyItem = z.object({
  name: z.string(),
  slug: z.string(),
});

const news = defineCollection({
  loader: glob({
    base: './src/content/news',
    pattern: '**/index.{md,mdx}',
  }),
  schema: ({ image }) =>
    z.object({
      sourceId: z.string(),
      slug: z.string(),
      sourceUrl: z.url(),
      canonicalUrl: z.url(),
      title: z.string(),
      seoTitle: z.string().optional(),
      summary: z.string(),
      description: z.string(),
      publishedAt: z.coerce.date(),
      updatedAt: z.coerce.date(),
      author: z.object({
        name: z.string(),
        type: z.enum(['Person', 'Organization']).default('Organization'),
      }),
      categories: z.array(taxonomyItem).default([]),
      tags: z.array(taxonomyItem).default([]),
      cover: z.object({
        src: image(),
        originalUrl: z.url(),
        alt: z.string(),
        width: z.number().int().positive().optional(),
        height: z.number().int().positive().optional(),
      }),
      keyTakeaways: z.array(z.string()).default([]),
      faq: z
        .array(
          z.object({
            question: z.string(),
            answer: z.string(),
          }),
        )
        .default([]),
      citations: z
        .array(
          z.object({
            name: z.string(),
            url: z.url(),
            publisher: z.string().optional(),
            publishedAt: z.coerce.date().optional(),
          }),
        )
        .default([]),
      language: z.string().default('en-US'),
      draft: z.boolean().default(false),
      scrapedAt: z.coerce.date(),
      sourceHash: z.string(),
    }),
});

export const collections = { news };
