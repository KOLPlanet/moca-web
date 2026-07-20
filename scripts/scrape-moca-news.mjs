#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import * as cheerio from 'cheerio';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';
import { stringify } from 'yaml';

const DEFAULT_LISTING_URL = 'https://www.moca-tech.net/news';
const DEFAULT_OUTPUT_DIR = path.resolve('src/content/news');
const USER_AGENT =
  'Mozilla/5.0 (compatible; MOCAContentImporter/1.0; +https://www.moca-tech.net/)';

const args = process.argv.slice(2);
const flags = new Set(args.filter((arg) => arg.startsWith('--')));
const values = args.filter((arg) => !arg.startsWith('--'));
const outputFlag = args.find((arg) => arg.startsWith('--output='));
const limitFlag = args.find((arg) => arg.startsWith('--limit='));
const outputDir = outputFlag
  ? path.resolve(outputFlag.slice('--output='.length))
  : DEFAULT_OUTPUT_DIR;
const limit = limitFlag
  ? Math.max(1, Number.parseInt(limitFlag.slice('--limit='.length), 10))
  : Number.POSITIVE_INFINITY;

if (flags.has('--help')) {
  printHelp();
  process.exit(0);
}

const listingCovers = new Map();
let urls = values;

if (flags.has('--all')) {
  urls = await collectNewsUrls(DEFAULT_LISTING_URL, listingCovers, limit);
}

if (urls.length === 0) {
  printHelp();
  process.exitCode = 1;
} else {
  const uniqueUrls = [...new Set(urls)].slice(0, limit);
  let failures = 0;

  for (const url of uniqueUrls) {
    try {
      const result = await scrapeArticle(url, {
        outputDir,
        listingCoverUrl: listingCovers.get(normalizeUrl(url)),
      });
      console.log(`✓ ${result.slug} -> ${path.relative(process.cwd(), result.file)}`);
    } catch (error) {
      failures += 1;
      console.error(`✗ ${url}`);
      console.error(error instanceof Error ? error.message : error);
    }
  }

  if (failures > 0) {
    process.exitCode = 1;
  }
}

function printHelp() {
  console.log(`Usage:
  npm run scrape:news -- <article-url> [more-urls...]
  npm run scrape:news:all -- [--limit=10]

Options:
  --all                 Discover article URLs from the MOCA news listing.
  --limit=<number>      Limit the number of articles processed.
  --output=<directory>  Override src/content/news.
  --help                Show this message.`);
}

async function collectNewsUrls(startUrl, coverMap, maxArticles) {
  const found = [];
  const seenPages = new Set();
  let pageUrl = startUrl;

  while (
    pageUrl &&
    !seenPages.has(pageUrl) &&
    found.length < maxArticles &&
    seenPages.size < 100
  ) {
    seenPages.add(pageUrl);
    const html = await fetchText(pageUrl);
    const $ = cheerio.load(html);

    $('article').each((_, article) => {
      const link = $(article)
        .find('a[href*="/news/"]')
        .toArray()
        .map((node) => $(node).attr('href'))
        .find((href) => href && isArticleUrl(href));

      if (!link) return;

      const absoluteUrl = normalizeUrl(link);
      if (!found.includes(absoluteUrl)) found.push(absoluteUrl);

      const image = $(article)
        .find('img')
        .toArray()
        .map((node) => getImageSource($(node)))
        .find(Boolean);

      if (image) {
        coverMap.set(absoluteUrl, new URL(image, pageUrl).href);
      }
    });

    const nextHref =
      $('a.next.page-numbers').attr('href') ||
      $('link[rel="next"]').attr('href') ||
      $('a[rel="next"]').attr('href');
    pageUrl = nextHref ? new URL(nextHref, pageUrl).href : undefined;
  }

  return found.slice(0, maxArticles);
}

async function scrapeArticle(rawUrl, options) {
  const sourceUrl = normalizeUrl(rawUrl);
  if (!isArticleUrl(sourceUrl)) {
    throw new Error(`Unsupported MOCA news URL: ${sourceUrl}`);
  }

  const html = await fetchText(sourceUrl);
  const $ = cheerio.load(html);
  const article = $('article[id^="post-"]').first();
  const content = article.find('.entry-content').first();

  if (!article.length || !content.length) {
    throw new Error('Could not find the WordPress article and .entry-content.');
  }

  const schemaNodes = readSchemaNodes($);
  const articleSchema = schemaNodes.find((node) =>
    schemaHasType(node, ['Article', 'NewsArticle']),
  );
  const faqSchema = schemaNodes.find((node) => schemaHasType(node, ['FAQPage']));
  const slug = getSlug(sourceUrl);
  const articleDir = path.join(options.outputDir, slug);
  const assetsDir = path.join(articleDir, 'assets');
  await mkdir(assetsDir, { recursive: true });

  const title =
    normalizeText(article.find('h1.entry-title').first().text()) ||
    normalizeText(articleSchema?.headline) ||
    normalizeText($('meta[property="og:title"]').attr('content'));
  const seoTitle =
    normalizeText($('meta[property="og:title"]').attr('content')) || title;
  const description =
    normalizeText($('meta[name="description"]').attr('content')) ||
    normalizeText(articleSchema?.description);
  const summary =
    normalizeText(content.find('.article-summary').first().text()).replace(
      /^In This Article:\s*/i,
      '',
    ) || description;
  const canonicalUrl =
    $('link[rel="canonical"]').attr('href') ||
    normalizeText(articleSchema?.mainEntityOfPage?.['@id']) ||
    sourceUrl;
  const publishedAt =
    $('meta[property="article:published_time"]').attr('content') ||
    article.find('time.published').attr('datetime') ||
    articleSchema?.datePublished;
  const updatedAt =
    $('meta[property="article:modified_time"]').attr('content') ||
    article.find('time.updated').attr('datetime') ||
    articleSchema?.dateModified ||
    publishedAt;

  if (!title || !description || !summary || !publishedAt || !updatedAt) {
    throw new Error('Required title, description, summary, or date metadata is missing.');
  }

  const categories = readTaxonomy(article, $, '.cat-links', 'category');
  const tags = readTaxonomy(article, $, '.tags-links', 'tag');
  const keyTakeaways = readKeyTakeaways(content, $);
  const faq = readFaq(faqSchema);
  const citations = readCitations(articleSchema);
  const author = readAuthor(article, articleSchema);
  const media = [];
  const downloadedByUrl = new Map();
  const usedNames = new Set();

  const ogImage = $('meta[property="og:image"]').attr('content');
  const schemaImage = readSchemaImage(articleSchema?.image);
  const featuredImage = getImageSource(article.find('.post-thumbnail img').first());
  const firstBodyImage = getImageSource(content.find('img').first());
  const coverUrl = [
    options.listingCoverUrl,
    ogImage,
    schemaImage,
    featuredImage,
    firstBodyImage,
  ]
    .filter(Boolean)
    .map((url) => new URL(url, sourceUrl).href)[0];

  if (!coverUrl) {
    throw new Error('No cover image was found in listing, Open Graph, schema, or article body.');
  }

  const cover = await downloadImage(coverUrl, 'cover', assetsDir, usedNames);
  downloadedByUrl.set(coverUrl, cover);
  media.push({ role: 'cover', ...cover });

  const body = content.clone();
  body.find('script, style, noscript, .sr-only, [data-moca-byline="true"]').remove();
  body.find('.article-summary').remove();

  body.find('div').each((_, element) => {
    const node = $(element);
    const label = normalizeText(node.find('strong').first().text()).replace(/:$/, '');

    if (/^(Key Takeaways|Quick Recap)$/i.test(label)) {
      node.remove();
      return;
    }

    if (/key finding/i.test(node.attr('aria-label') || '')) {
      node.replaceWith(`<blockquote>${node.html() || ''}</blockquote>`);
    }
  });

  body.find('details').each((_, element) => {
    const node = $(element);
    const question = normalizeText(node.find('summary').first().text());
    node.find('summary').remove();
    node.replaceWith(
      `<section><h3>${escapeHtml(question)}</h3>${node.html() || ''}</section>`,
    );
  });

  const bodyImages = body.find('img').toArray();
  for (const [index, element] of bodyImages.entries()) {
    const image = $(element);
    const originalSource = getImageSource(image);
    if (!originalSource) continue;

    const absoluteSource = new URL(originalSource, sourceUrl).href;
    let downloaded = downloadedByUrl.get(absoluteSource);

    if (!downloaded) {
      downloaded = await downloadImage(
        absoluteSource,
        filenameStem(absoluteSource) || `article-image-${index + 1}`,
        assetsDir,
        usedNames,
      );
      downloadedByUrl.set(absoluteSource, downloaded);
      media.push({ role: 'body', alt: image.attr('alt') || '', ...downloaded });
    }

    image.attr('src', `./assets/${downloaded.filename}`);
    image.removeAttr('srcset sizes data-src data-lazy-src data-original loading');
  }

  body.find('a[href]').each((_, element) => {
    const link = $(element);
    const href = link.attr('href');
    if (!href) return;

    try {
      const url = new URL(href, sourceUrl);
      if (url.hostname === 'www.moca-tech.net' && isArticleUrl(url.href)) {
        link.attr('href', `/news/${getSlug(url.href)}`);
      }
    } catch {
      // Keep non-URL href values unchanged.
    }
  });

  body.find('*').each((_, element) => {
    const node = $(element);
    for (const attribute of Object.keys(element.attribs || {})) {
      if (
        attribute === 'style' ||
        attribute === 'class' ||
        attribute === 'id' ||
        attribute.startsWith('data-') ||
        attribute.startsWith('aria-') ||
        attribute === 'role'
      ) {
        node.removeAttr(attribute);
      }
    }
  });

  const markdown = htmlToMarkdown(body.html() || '');
  const sourceHash = createHash('sha256').update(markdown).digest('hex');
  const normalizedOgImage = ogImage ? new URL(ogImage, sourceUrl).href : undefined;
  const coverWidth =
    coverUrl === normalizedOgImage
      ? positiveInteger($('meta[property="og:image:width"]').attr('content'))
      : undefined;
  const coverHeight =
    coverUrl === normalizedOgImage
      ? positiveInteger($('meta[property="og:image:height"]').attr('content'))
      : undefined;
  const sourceId = article.attr('id')?.replace(/^post-/, '') || slug;
  const frontmatter = {
    sourceId,
    slug,
    sourceUrl,
    canonicalUrl: new URL(canonicalUrl, sourceUrl).href,
    title,
    seoTitle,
    summary,
    description,
    publishedAt,
    updatedAt,
    author,
    categories,
    tags,
    cover: {
      src: `./assets/${cover.filename}`,
      originalUrl: coverUrl,
      alt: title,
      ...(coverWidth ? { width: coverWidth } : {}),
      ...(coverHeight ? { height: coverHeight } : {}),
    },
    keyTakeaways,
    faq,
    citations,
    language: $('html').attr('lang') || 'en-US',
    draft: false,
    scrapedAt: new Date().toISOString(),
    sourceHash,
  };

  const file = path.join(articleDir, 'index.md');
  const document = `---\n${stringify(frontmatter, { lineWidth: 0 }).trim()}\n---\n\n${markdown}\n`;
  await writeFile(file, document, 'utf8');
  await writeFile(
    path.join(articleDir, 'source.json'),
    `${JSON.stringify(
      {
        sourceUrl,
        canonicalUrl: frontmatter.canonicalUrl,
        sourceId,
        scrapedAt: frontmatter.scrapedAt,
        sourceHash,
        media,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );

  return { slug, file };
}

function htmlToMarkdown(html) {
  const turndown = new TurndownService({
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
    emDelimiter: '*',
    headingStyle: 'atx',
    strongDelimiter: '**',
  });

  turndown.use(gfm);
  turndown.keep(['sup', 'sub']);
  turndown.addRule('figure', {
    filter: 'figure',
    replacement(_content, node) {
      const image = node.getElementsByTagName('img')[0];
      const caption = node.getElementsByTagName('figcaption')[0];
      if (!image) return '';

      const alt = (image.getAttribute('alt') || '').replace(/[\[\]]/g, '');
      const src = image.getAttribute('src') || '';
      const captionText = caption?.textContent?.trim();
      return `\n\n![${alt}](${src})${
        captionText ? `\n\n*${captionText}*` : ''
      }\n\n`;
    },
  });

  return turndown
    .turndown(html)
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function readSchemaNodes($) {
  const nodes = [];

  $('script[type="application/ld+json"]').each((_, element) => {
    const json = $(element).html();
    if (!json) return;

    try {
      flattenSchema(JSON.parse(json), nodes);
    } catch {
      // Third-party schema can be malformed; the article HTML remains authoritative.
    }
  });

  return nodes;
}

function flattenSchema(value, nodes) {
  if (Array.isArray(value)) {
    for (const item of value) flattenSchema(item, nodes);
    return;
  }

  if (!value || typeof value !== 'object') return;
  if (value['@type']) nodes.push(value);
  if (value['@graph']) flattenSchema(value['@graph'], nodes);
}

function schemaHasType(node, types) {
  const values = Array.isArray(node?.['@type']) ? node['@type'] : [node?.['@type']];
  return values.some((value) => types.includes(value));
}

function readSchemaImage(image) {
  if (typeof image === 'string') return image;
  if (Array.isArray(image)) return readSchemaImage(image[0]);
  return image?.url || image?.contentUrl;
}

function readKeyTakeaways(content, $) {
  const container = content
    .find('div')
    .toArray()
    .map((element) => $(element))
    .find((node) =>
      /^Key Takeaways:?$/i.test(normalizeText(node.find('strong').first().text())),
    );

  return container
    ? container
        .find('li')
        .toArray()
        .map((element) => normalizeText($(element).text()))
        .filter(Boolean)
    : [];
}

function readFaq(faqSchema) {
  const entities = Array.isArray(faqSchema?.mainEntity)
    ? faqSchema.mainEntity
    : faqSchema?.mainEntity
      ? [faqSchema.mainEntity]
      : [];

  return entities
    .map((entity) => ({
      question: normalizeText(entity?.name),
      answer: normalizeText(entity?.acceptedAnswer?.text),
    }))
    .filter((item) => item.question && item.answer);
}

function readCitations(articleSchema) {
  const values = Array.isArray(articleSchema?.citation)
    ? articleSchema.citation
    : articleSchema?.citation
      ? [articleSchema.citation]
      : [];

  return values
    .map((citation) => ({
      name: normalizeText(citation?.name),
      url: citation?.url,
      ...(normalizeText(citation?.publisher?.name)
        ? { publisher: normalizeText(citation.publisher.name) }
        : {}),
      ...(citation?.datePublished ? { publishedAt: `${citation.datePublished}` } : {}),
    }))
    .filter((citation) => citation.name && isHttpUrl(citation.url));
}

function readAuthor(article, articleSchema) {
  const schemaAuthor = Array.isArray(articleSchema?.author)
    ? articleSchema.author[0]
    : articleSchema?.author;
  const name =
    normalizeText(schemaAuthor?.name) ||
    normalizeText(article.find('.author').first().text()) ||
    'MOCA Technology';
  const type = schemaAuthor?.['@type'] === 'Person' ? 'Person' : 'Organization';
  return { name, type };
}

function readTaxonomy(article, $, selector, type) {
  return article
    .find(`${selector} a`)
    .toArray()
    .map((element) => {
      const link = $(element);
      const href = link.attr('href') || '';
      return {
        name: normalizeText(link.text()),
        slug: taxonomySlug(href, type),
      };
    })
    .filter((item) => item.name && item.slug);
}

function taxonomySlug(href, type) {
  try {
    const segments = new URL(href).pathname.split('/').filter(Boolean);
    return segments.includes(type) ? segments.at(-1) || '' : '';
  } catch {
    return '';
  }
}

async function downloadImage(url, preferredStem, assetsDir, usedNames) {
  const response = await fetch(url, {
    headers: {
      Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      'User-Agent': USER_AGENT,
    },
    redirect: 'follow',
  });

  if (!response.ok) {
    throw new Error(`Image request failed (${response.status}): ${url}`);
  }

  const contentType = (response.headers.get('content-type') || '')
    .split(';')[0]
    .toLowerCase();
  if (contentType && !contentType.startsWith('image/')) {
    throw new Error(`Expected an image but received ${contentType}: ${url}`);
  }

  const extension = extensionFor(contentType, url);
  const stem = slugify(preferredStem) || 'image';
  let filename = `${stem}.${extension}`;
  let suffix = 2;
  while (usedNames.has(filename)) {
    filename = `${stem}-${suffix}.${extension}`;
    suffix += 1;
  }
  usedNames.add(filename);

  const data = Buffer.from(await response.arrayBuffer());
  await writeFile(path.join(assetsDir, filename), data);

  return {
    originalUrl: url,
    filename,
    contentType: contentType || `image/${extension}`,
    bytes: data.byteLength,
    sha256: createHash('sha256').update(data).digest('hex'),
  };
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9',
      'User-Agent': USER_AGENT,
    },
    redirect: 'follow',
  });

  if (!response.ok) {
    throw new Error(`Page request failed (${response.status}): ${url}`);
  }

  return response.text();
}

function getImageSource(node) {
  if (!node?.length) return undefined;
  return (
    node.attr('data-lazy-src') ||
    node.attr('data-src') ||
    node.attr('data-original') ||
    node.attr('src')
  );
}

function extensionFor(contentType, url) {
  const byType = {
    'image/avif': 'avif',
    'image/gif': 'gif',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/svg+xml': 'svg',
    'image/webp': 'webp',
  };
  if (byType[contentType]) return byType[contentType];

  const extension = path.extname(new URL(url).pathname).slice(1).toLowerCase();
  return /^(avif|gif|jpe?g|png|svg|webp)$/.test(extension)
    ? extension.replace('jpeg', 'jpg')
    : 'jpg';
}

function filenameStem(url) {
  try {
    const basename = path.basename(decodeURIComponent(new URL(url).pathname));
    return basename.replace(/\.[^.]+$/, '');
  } catch {
    return '';
  }
}

function getSlug(url) {
  const pathname = new URL(url).pathname.replace(/\/+$/, '');
  return slugify(path.basename(pathname).replace(/\.html?$/i, ''));
}

function slugify(value) {
  return `${value || ''}`
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeText(value) {
  return `${value || ''}`.replace(/\s+/g, ' ').trim();
}

function normalizeUrl(value) {
  const url = new URL(value, DEFAULT_LISTING_URL);
  url.hash = '';
  return url.href;
}

function isArticleUrl(value) {
  try {
    const url = new URL(value, DEFAULT_LISTING_URL);
    if (!['moca-tech.net', 'www.moca-tech.net'].includes(url.hostname)) return false;
    const segments = url.pathname.split('/').filter(Boolean);
    return (
      segments[0] === 'news' &&
      segments.length === 2 &&
      !['page', 'category', 'tag', 'author', 'feed'].includes(segments[1])
    );
  } catch {
    return false;
  }
}

function isHttpUrl(value) {
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

function positiveInteger(value) {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function escapeHtml(value) {
  return `${value || ''}`
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
