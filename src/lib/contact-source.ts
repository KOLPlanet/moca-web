const KEY = 'moca_last_news_page';

// Remember the last /news article read in this tab session, so a later contact-form
// submission can say which article the visitor came from.
export const rememberNewsPage = (path: string) => {
  try {
    sessionStorage.setItem(KEY, path);
  } catch {
    // Storage can be blocked; the form then falls back to the referrer.
  }
};

export const contactSourcePage = () => {
  try {
    const remembered = sessionStorage.getItem(KEY);
    if (remembered) return remembered;
  } catch {
    // fall through to the referrer
  }
  try {
    const referrer = new URL(document.referrer);
    if (referrer.origin === location.origin) return referrer.pathname;
  } catch {
    // empty or invalid referrer
  }
  return '/';
};
