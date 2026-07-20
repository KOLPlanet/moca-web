# MOCA Web

Astro foundation for the MOCA marketing site.

## Routes

- `/` — homepage sections for Features, About, Solutions, Cases, News, and Contact.
- `/news` — standalone news index.
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
