# MOCA Web

Astro foundation for the MOCA marketing site.

## Routes

- `/` — homepage sections for Features, About, Solutions, Cases, News, and Contact.
- `/news` — standalone news index.
- `/news/[slug]` — statically rendered article pages backed by Astro content collections.
- `/api/contact` — server endpoint that forwards form submissions to a configured mail-service webhook.

All header links except News point to sections on `/`.

## Local development

```sh
npm install
cp .env.example .env
npm run dev
```

The site can run without `.env`, but the contact form returns a configuration
message until all contact mail variables are set.

## Contact mail contract

`CONTACT_MAIL_SERVICE_URL` receives a `POST` request with a bearer token from
`CONTACT_MAIL_SERVICE_TOKEN` and this JSON body:

```json
{
  "from": "website@example.com",
  "to": "hello@example.com",
  "replyTo": "visitor@example.com",
  "subject": "[MOCA Website] Visitor subject",
  "text": "Name: Visitor\nEmail: visitor@example.com\n\nMessage body"
}
```

Update the `payload` in `src/pages/api/contact.ts` when a chosen mail provider
uses a different API shape.

## News ingestion

Scrape one or more MOCA articles:

```sh
npm run scrape:news -- https://www.moca-tech.net/news/article-slug.html
```

Discover and scrape articles from the news listing:

```sh
npm run scrape:news:all -- --limit=10
```

Each article is isolated under `src/content/news/<slug>/`:

```text
index.md
source.json
assets/
  cover.<ext>
  article-image.<ext>
```

`index.md` contains validated Astro frontmatter plus clean Markdown. The
frontmatter keeps editorial fields (title, summary, description, dates, author,
categories, tags, takeaways, FAQ, citations, and cover metadata). `source.json`
keeps source provenance, a content hash, and downloaded-media checksums for
repeatable imports. Cover and body image URLs are rewritten to local assets.
