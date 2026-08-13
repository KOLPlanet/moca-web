import type { APIRoute } from 'astro';
import {
  ContactMailConfigurationError,
  sendContactMail,
} from '../../lib/contact-mail';

const isStaticDeployment = ['github-pages', 'cloudflare-pages'].includes(
  process.env.DEPLOY_TARGET ?? '',
);

export const prerender = isStaticDeployment;

const MAX_BODY_BYTES = 4_000_000;
const MAX_FILE_BYTES = 3_500_000;
const ALLOWED_FILE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
  'application/pdf',
]);

const safeFilename = (name: string) =>
  name.replace(/[^\w.\- ()[\]]+/g, '_').replace(/^\.+/, '').slice(0, 80) || 'rate-card';

const readRateCard = async (form: FormData) => {
  const file = form.get('rateCard');
  if (!(file instanceof File) || file.size === 0) return undefined;
  if (file.size > MAX_FILE_BYTES) {
    throw new Error('The rate card file is too large. Please use a file under 3.5MB.');
  }
  const type = file.type || '';
  const lower = file.name.toLowerCase();
  const allowed =
    ALLOWED_FILE_TYPES.has(type) ||
    /\.(jpe?g|png|webp|gif|heic|heif|pdf)$/.test(lower);
  if (!allowed) {
    throw new Error('Please upload a photo, screenshot, or PDF.');
  }
  return {
    filename: safeFilename(file.name),
    contentType: type || (lower.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'),
    content: Buffer.from(await file.arrayBuffer()),
  };
};

const permittedOrigin = (request: Request) => {
  const origin = request.headers.get('Origin');
  if (!origin) return null;
  if (origin === new URL(request.url).origin) return origin;

  const allowed = (process.env.CONTACT_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  return allowed.includes(origin) ? origin : false;
};

const responseHeaders = (origin: string | null) => {
  const headers = new Headers({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });

  if (origin) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Content-Type');
    headers.set('Vary', 'Origin');
  }

  return headers;
};

const json = (
  body: Record<string, unknown>,
  status = 200,
  origin: string | null = null,
) =>
  new Response(JSON.stringify(body), {
    status,
    headers: responseHeaders(origin),
  });

const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const withinLimit = (value: string, maximum: number) =>
  value.length > 0 && value.length <= maximum;

export const GET: APIRoute = () =>
  json({ message: 'The contact endpoint only accepts POST requests.' }, 405);

export const OPTIONS: APIRoute = ({ request }) => {
  const origin = permittedOrigin(request);
  if (origin === false) {
    return json({ message: 'Origin is not allowed.' }, 403);
  }
  return new Response(null, { status: 204, headers: responseHeaders(origin) });
};

export const POST: APIRoute = async ({ request }) => {
  const origin = permittedOrigin(request);
  if (origin === false) {
    return json({ message: 'Origin is not allowed.' }, 403);
  }

  const contentLength = Number(request.headers.get('content-length') ?? 0);

  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return json({ message: 'The submitted message is too large.' }, 413, origin);
  }

  const form = await request.formData();
  const name = String(form.get('name') ?? '').trim();
  const email = String(form.get('email') ?? '').trim();
  const subject = String(form.get('subject') ?? '').trim();
  const message = String(form.get('message') ?? '').trim();
  const company = String(form.get('company') ?? '').trim();

  if (company) {
    return json({ message: 'Thanks — your message has been received.' }, 200, origin);
  }

  if (
    !withinLimit(name, 120) ||
    !isEmail(email) ||
    email.length > 254 ||
    !withinLimit(subject, 180) ||
    !withinLimit(message, 10_000)
  ) {
    return json(
      {
        message:
          'Please complete every field with a valid email address and keep the message under 10,000 characters.',
      },
      400,
      origin,
    );
  }

  let attachment;
  try {
    attachment = await readRateCard(form);
  } catch (error) {
    return json(
      { message: error instanceof Error ? error.message : 'Unable to read the rate card file.' },
      400,
      origin,
    );
  }

  try {
    await sendContactMail({ name, email, subject, message, attachment });
    return json({ message: 'Thanks — your message has been sent.' }, 200, origin);
  } catch (error) {
    if (error instanceof ContactMailConfigurationError) {
      console.error('[contact] Mail delivery is not configured:', error.message);
      return json(
        {
          message:
            'Mail delivery is not configured yet. Add the contact variables from .env.example.',
        },
        503,
        origin,
      );
    }

    console.error('[contact] Mail delivery failed:', error);
    return json(
      { message: 'The mail service is temporarily unavailable.' },
      502,
      origin,
    );
  }
};
