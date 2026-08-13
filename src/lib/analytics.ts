export type AnalyticsEventName =
  | 'contact_form_error'
  | 'cta_click'
  | 'generate_lead'
  | 'section_view'
  | 'video_complete'
  | 'video_progress'
  | 'video_start';

export type AnalyticsEventParameters = Record<
  string,
  boolean | number | string | undefined
>;

type AnalyticsWindow = Window & {
  gtag?: (
    command: 'event',
    eventName: AnalyticsEventName,
    parameters?: Record<string, boolean | number | string>,
  ) => void;
};

export const trackAnalyticsEvent = (
  eventName: AnalyticsEventName,
  parameters: AnalyticsEventParameters = {},
) => {
  if (document.documentElement.dataset.analyticsEnabled !== 'true') return;

  const gtag = (window as AnalyticsWindow).gtag;
  if (typeof gtag !== 'function') return;

  const definedParameters = Object.fromEntries(
    Object.entries(parameters).filter((entry): entry is [string, boolean | number | string] =>
      entry[1] !== undefined,
    ),
  );

  gtag('event', eventName, definedParameters);
};
