// Fetches the signed token /api/contact expects with every submission (see contact-guard.ts).
// The server only accepts tokens that are a couple of seconds old, so the form starts the
// request as soon as the visitor begins filling it in, and reuses that one token on submit.

const tokenUrl = (endpoint: string) => {
  const url = new URL(endpoint, window.location.href);
  url.searchParams.set('token', '1');
  return url.toString();
};

export const createContactTokenSource = (endpoint: string) => {
  let pending: Promise<string> | undefined;

  const fetchToken = async () => {
    try {
      const response = await fetch(tokenUrl(endpoint), {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });
      if (!response.ok) return '';
      const result: { token?: unknown } = await response.json();
      return typeof result.token === 'string' ? result.token : '';
    } catch {
      return '';
    }
  };

  return {
    prefetch() {
      pending ??= fetchToken();
    },
    async take() {
      const token = await (pending ?? fetchToken());
      // Have a fresh one ready (and already a few seconds old) for a retry or a second message.
      pending = fetchToken();
      return token;
    },
  };
};
