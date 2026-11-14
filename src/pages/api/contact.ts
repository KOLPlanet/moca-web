import type { APIRoute } from 'astro';
import {
  ContactMailConfigurationError,
  sendContactMail,
  type ContactType,
} from '../../lib/contact-mail';
import {
  allowSubmission,
  checkFormToken,
  clientKeyFor,
  issueFormToken,
} from '../../lib/contact-guard';

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
const contactTypeFor = (value: FormDataEntryValue | null): ContactType | null => {
  const normalized = String(value ?? '').trim().toLowerCase();
  return normalized === 'business' || normalized === 'creator' ? normalized : null;
};
// A site-relative path only (sent by our own form); anything else is dropped, never echoed into a mail header.
const sourcePageFor = (value: FormDataEntryValue | null) => {
  const path = String(value ?? '').trim();
  return /^\/[\w\-.~%/]{0,199}$/.test(path) ? path : undefined;
};
const mailUnavailableMessage = (contactType: ContactType) =>
  contactType === 'business'
    ? 'Mail delivery is temporarily unavailable. Please email business@moca-tech.net directly.'
    : 'Mail delivery is temporarily unavailable. Please email collaboration@kolplanet.com directly.';

// What a silently dropped submission gets back: the same reply as a real one, so bots
// cannot tell they were filtered.
const dropped = (origin: string | null, reason: string, request: Request) => {
  console.warn(
    `[contact] Dropped submission (${reason}); ua=${JSON.stringify(
      request.headers.get('user-agent') ?? '',
    )}`,
  );
  return json(
    { accepted: false, message: 'Thanks — your message has been sent.' },
    200,
    origin,
  );
};

const clientKey = (request: Request, clientAddress: () => string) => {
  try {
    return clientKeyFor(request, clientAddress());
  } catch {
    return clientKeyFor(request);
  }
};

// GET /api/contact?token issues the signed form token the pages fetch before submitting.
export const GET: APIRoute = ({ request, url }) => {
  if (!url.searchParams.has('token')) {
    return json({ message: 'The contact endpoint only accepts POST requests.' }, 405);
  }
  const origin = permittedOrigin(request);
  if (origin === false) {
    return json({ message: 'Origin is not allowed.' }, 403);
  }
  return json({ token: issueFormToken() ?? '' }, 200, origin);
};

export const OPTIONS: APIRoute = ({ request }) => {
  const origin = permittedOrigin(request);
  if (origin === false) {
    return json({ message: 'Origin is not allowed.' }, 403);
  }
  return new Response(null, { status: 204, headers: responseHeaders(origin) });
};

export const POST: APIRoute = async ({ request, clientAddress }) => {
  const origin = permittedOrigin(request);
  if (origin === false) {
    return json({ message: 'Origin is not allowed.' }, 403);
  }
  // Browsers always send Origin on a POST; scripts posting straight to the API usually do not.
  if (origin === null) {
    return dropped(origin, 'no origin', request);
  }

  if (!allowSubmission(clientKey(request, () => clientAddress))) {
    return json(
      {
        message:
          'Too many messages were sent from your network. Please try again later or email us directly.',
      },
      429,
      origin,
    );
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
  const contactType = contactTypeFor(form.get('contactType'));
  const sourcePage = sourcePageFor(form.get('sourcePage'));

  if (company) {
    return json(
      { accepted: false, message: 'Thanks — your message has been received.' },
      200,
      origin,
    );
  }

  const tokenCheck = checkFormToken(form.get('formToken'));
  if (tokenCheck === 'missing' || tokenCheck === 'invalid') {
    return dropped(origin, `form token ${tokenCheck}`, request);
  }
  if (tokenCheck === 'too_fast') {
    return json({ message: 'Please wait a moment and send again.' }, 400, origin);
  }
  if (tokenCheck === 'expired') {
    return json(
      { message: 'This form has expired. Please refresh the page and send again.' },
      400,
      origin,
    );
  }

  if (!contactType) {
    return json({ message: 'The contact form type is invalid.' }, 400, origin);
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
    await sendContactMail({ contactType, name, email, subject, message, sourcePage, attachment });
    return json(
      { accepted: true, message: 'Thanks — your message has been sent.' },
      200,
      origin,
    );
  } catch (error) {
    if (error instanceof ContactMailConfigurationError) {
      console.error('[contact] Mail delivery is not configured:', error.message);
      return json(
        {
          message: mailUnavailableMessage(contactType),
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
