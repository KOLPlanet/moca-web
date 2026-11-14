import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

// Anti-spam checks for /api/contact. Our pages are prerendered, so the form asks the
// API for a signed, timestamped token before it submits. Bots that scrape the form and
// POST it straight to the endpoint arrive without one and are dropped silently.

const MIN_TOKEN_AGE_MS = 2_000;
const MAX_TOKEN_AGE_MS = 24 * 60 * 60 * 1000;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX_SUBMISSIONS = 5;

export type FormTokenCheck = 'ok' | 'disabled' | 'missing' | 'invalid' | 'too_fast' | 'expired';

const signingKey = () => {
  const material =
    process.env.CONTACT_FORM_SECRET?.trim() ||
    process.env.SMTP_PASSWORD ||
    process.env.CONTACT_MAIL_SERVICE_TOKEN?.trim();
  if (!material) return undefined;
  // Derived, so the mail credential itself is never used directly as an HMAC key.
  return createHash('sha256').update(`moca-contact-form-token:${material}`).digest();
};

const sign = (key: Buffer, issuedAt: string) =>
  createHmac('sha256', key).update(issuedAt).digest('base64url');

export const issueFormToken = (now = Date.now()) => {
  const key = signingKey();
  if (!key) return undefined;
  const issuedAt = now.toString(36);
  return `${issuedAt}.${sign(key, issuedAt)}`;
};

export const checkFormToken = (
  value: FormDataEntryValue | null,
  now = Date.now(),
): FormTokenCheck => {
  const key = signingKey();
  if (!key) return 'disabled';

  const token = typeof value === 'string' ? value.trim() : '';
  if (!token) return 'missing';

  const [issuedAt, signature, extra] = token.split('.');
  if (!issuedAt || !signature || extra !== undefined) return 'invalid';

  const expected = Buffer.from(sign(key, issuedAt));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    return 'invalid';
  }

  const age = now - Number.parseInt(issuedAt, 36);
  if (!Number.isFinite(age) || age < -60_000) return 'invalid';
  if (age < MIN_TOKEN_AGE_MS) return 'too_fast';
  if (age > MAX_TOKEN_AGE_MS) return 'expired';
  return 'ok';
};

// Best effort: serverless instances do not share memory, but warm instances are reused,
// which is enough to stop one address from flooding the inbox.
const recentSubmissions = new Map<string, number[]>();

export const allowSubmission = (clientKey: string, now = Date.now()) => {
  const cutoff = now - RATE_WINDOW_MS;
  const recent = (recentSubmissions.get(clientKey) ?? []).filter((time) => time > cutoff);
  if (recent.length >= RATE_MAX_SUBMISSIONS) {
    recentSubmissions.set(clientKey, recent);
    return false;
  }
  recent.push(now);
  recentSubmissions.set(clientKey, recent);

  if (recentSubmissions.size > 5_000) {
    for (const [key, times] of recentSubmissions) {
      if (!times.some((time) => time > cutoff)) recentSubmissions.delete(key);
    }
  }
  return true;
};

export const clientKeyFor = (request: Request, clientAddress?: string) =>
  clientAddress ||
  request.headers.get('x-real-ip')?.trim() ||
  request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
  'unknown';
