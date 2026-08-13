interface Env {
  CONTACT_ALLOWED_ORIGINS?: string;
  CONTACT_FROM_NAME?: string;
  CONTACT_FROM_EMAIL?: string;
  CONTACT_MAIL_SERVICE_TOKEN?: string;
  CONTACT_MAIL_SERVICE_URL?: string;
  CONTACT_SUBJECT_PREFIX?: string;
  CONTACT_TO_EMAIL?: string;
}

interface PagesContext {
  env: Env;
  request: Request;
}

type PagesHandler = (context: PagesContext) => Promise<Response> | Response;

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

const bytesToBase64 = (bytes: Uint8Array) => {
  let binary = '';
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
};

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
    content: bytesToBase64(new Uint8Array(await file.arrayBuffer())),
  };
};
const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const withinLimit = (value: string, maximum: number) =>
  value.length > 0 && value.length <= maximum;

const permittedOrigin = (request: Request, env: Env) => {
  const origin = request.headers.get('Origin');
  if (!origin) return null;
  if (origin === new URL(request.url).origin) return origin;

  const allowed = (env.CONTACT_ALLOWED_ORIGINS ?? '')
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
  status: number,
  origin: string | null,
) =>
  new Response(JSON.stringify(body), {
    status,
    headers: responseHeaders(origin),
  });

export const onRequestOptions: PagesHandler = ({ env, request }) => {
  const origin = permittedOrigin(request, env);
  if (origin === false) {
    return json({ message: 'Origin is not allowed.' }, 403, null);
  }
  return new Response(null, { status: 204, headers: responseHeaders(origin) });
};

export const onRequestPost: PagesHandler = async ({ env, request }) => {
  const origin = permittedOrigin(request, env);
  if (origin === false) {
    return json({ message: 'Origin is not allowed.' }, 403, null);
  }

  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return json({ message: 'The submitted message is too large.' }, 413, origin);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ message: 'The submitted form could not be read.' }, 400, origin);
  }

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
    !withinLimit(message, 5_000)
  ) {
    return json(
      {
        message:
          'Please complete every field with a valid email address and keep the message under 5,000 characters.',
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
      {
        message: error instanceof Error ? error.message : 'Unable to read the rate card file.',
      },
      400,
      origin,
    );
  }

  const endpoint = env.CONTACT_MAIL_SERVICE_URL?.trim();
  const token = env.CONTACT_MAIL_SERVICE_TOKEN?.trim();
  const from = env.CONTACT_FROM_EMAIL?.trim();
  const to = env.CONTACT_TO_EMAIL?.trim();

  if (!endpoint || !token || !from || !to) {
    console.error('[contact] Cloudflare mail webhook variables are incomplete.');
    return json({ message: 'Mail delivery is not configured yet.' }, 503, origin);
  }

  const safeSubject = subject.replace(/[\r\n]+/g, ' ').trim();
  const prefix = env.CONTACT_SUBJECT_PREFIX?.trim() || '[MOCA Website]';

  try {
    const mailResponse = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        fromName: env.CONTACT_FROM_NAME?.trim() || 'MOCA Website',
        to,
        replyTo: email,
        subject: `${prefix} ${safeSubject}`,
        text: [`Name: ${name}`, `Email: ${email}`, '', message].join('\n'),
        attachments: attachment
          ? [
              {
                filename: attachment.filename,
                contentType: attachment.contentType,
                content: attachment.content,
              },
            ]
          : undefined,
      }),
    });

    if (!mailResponse.ok) {
      throw new Error(`Mail service returned HTTP ${mailResponse.status}.`);
    }

    return json({ message: 'Thanks — your message has been sent.' }, 200, origin);
  } catch (error) {
    console.error('[contact] Cloudflare mail delivery failed:', error);
    return json(
      { message: 'The mail service is temporarily unavailable.' },
      502,
      origin,
    );
  }
};
