import nodemailer from 'nodemailer';

export interface ContactMessage {
  name: string;
  email: string;
  subject: string;
  message: string;
}

export class ContactMailConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ContactMailConfigurationError';
  }
}

const booleanValue = (value: string | undefined, fallback = false) => {
  if (!value) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
};

const required = (name: string) => {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new ContactMailConfigurationError(`${name} is not configured.`);
  }
  return value;
};

const subjectFor = (subject: string) => {
  const prefix = process.env.CONTACT_SUBJECT_PREFIX?.trim() || '[MOCA Website]';
  const safeSubject = subject.replace(/[\r\n]+/g, ' ').trim();
  return `${prefix} ${safeSubject}`;
};

const textFor = ({ name, email, message }: ContactMessage) =>
  [`Name: ${name}`, `Email: ${email}`, '', message].join('\n');

async function sendWithSmtp(contact: ContactMessage) {
  const host = required('SMTP_HOST');
  const portValue = process.env.SMTP_PORT?.trim() || '587';
  const port = Number.parseInt(portValue, 10);
  const from = required('CONTACT_FROM_EMAIL');
  const to = required('CONTACT_TO_EMAIL');
  const user = process.env.SMTP_USER?.trim();
  const password = process.env.SMTP_PASSWORD;

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new ContactMailConfigurationError('SMTP_PORT must be a valid TCP port.');
  }

  if ((user && !password) || (!user && password)) {
    throw new ContactMailConfigurationError(
      'SMTP_USER and SMTP_PASSWORD must either both be set or both be omitted.',
    );
  }

  const transport = nodemailer.createTransport({
    host,
    port,
    secure: booleanValue(process.env.SMTP_SECURE, port === 465),
    requireTLS: booleanValue(process.env.SMTP_REQUIRE_TLS, port !== 465),
    auth: user && password ? { user, pass: password } : undefined,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });

  await transport.sendMail({
    from: {
      name: process.env.CONTACT_FROM_NAME?.trim() || 'MOCA Website',
      address: from,
    },
    to,
    replyTo: {
      name: contact.name,
      address: contact.email,
    },
    subject: subjectFor(contact.subject),
    text: textFor(contact),
  });
}

async function sendWithWebhook(contact: ContactMessage) {
  const endpoint = required('CONTACT_MAIL_SERVICE_URL');
  const token = required('CONTACT_MAIL_SERVICE_TOKEN');
  const from = required('CONTACT_FROM_EMAIL');
  const to = required('CONTACT_TO_EMAIL');

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      fromName: process.env.CONTACT_FROM_NAME?.trim() || 'MOCA Website',
      to,
      replyTo: contact.email,
      subject: subjectFor(contact.subject),
      text: textFor(contact),
    }),
  });

  if (!response.ok) {
    throw new Error(`Mail service returned HTTP ${response.status}.`);
  }
}

export async function sendContactMail(contact: ContactMessage) {
  const configuredTransport = process.env.CONTACT_MAIL_TRANSPORT
    ?.trim()
    .toLowerCase();
  const transport =
    configuredTransport || (process.env.SMTP_HOST ? 'smtp' : 'webhook');

  if (transport === 'smtp') {
    await sendWithSmtp(contact);
    return;
  }

  if (transport === 'webhook') {
    await sendWithWebhook(contact);
    return;
  }

  throw new ContactMailConfigurationError(
    'CONTACT_MAIL_TRANSPORT must be either "smtp" or "webhook".',
  );
}
