import type { APIRoute } from 'astro';

export const prerender = false;

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });

const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export const POST: APIRoute = async ({ request }) => {
  const form = await request.formData();
  const name = String(form.get('name') ?? '').trim();
  const email = String(form.get('email') ?? '').trim();
  const subject = String(form.get('subject') ?? '').trim();
  const message = String(form.get('message') ?? '').trim();
  const company = String(form.get('company') ?? '').trim();

  if (company) {
    return json({ message: 'Thanks — your message has been received.' });
  }

  if (!name || !isEmail(email) || !subject || !message) {
    return json({ message: 'Please complete every field with a valid email address.' }, 400);
  }

  const endpoint = import.meta.env.CONTACT_MAIL_SERVICE_URL;
  const token = import.meta.env.CONTACT_MAIL_SERVICE_TOKEN;
  const from = import.meta.env.CONTACT_FROM_EMAIL;
  const to = import.meta.env.CONTACT_TO_EMAIL;

  if (!endpoint || !token || !from || !to) {
    return json(
      {
        message:
          'Mail delivery is not configured yet. Add the contact variables from .env.example.',
      },
      503,
    );
  }

  // Provider-neutral payload expected by CONTACT_MAIL_SERVICE_URL.
  // Adapt this one object if the selected mail provider uses a different contract.
  const payload = {
    from,
    to,
    replyTo: email,
    subject: `[MOCA Website] ${subject}`,
    text: [`Name: ${name}`, `Email: ${email}`, '', message].join('\n'),
  };

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      return json({ message: 'The mail service could not deliver your message.' }, 502);
    }

    return json({ message: 'Thanks — your message has been sent.' });
  } catch {
    return json({ message: 'The mail service is temporarily unavailable.' }, 502);
  }
};
