# Design QA

## Comparison target

- Source visual truth:
  - `reference-captures/source-home-desktop-viewport.png`
  - `reference-captures/source-news-desktop-viewport.png`
  - `reference-captures/source-menu-mobile.png`
- Rendered implementation:
  - `qa-captures/home-desktop-viewport.png`
  - `qa-captures/news-desktop-viewport.png`
  - `qa-captures/home-mobile-viewport.png`
  - `qa-captures/home-mobile-menu.png`
  - `qa-captures/news-mobile-viewport.png`
- Normalized full-view comparisons:
  - `qa-captures/comparison-home-desktop.png`
  - `qa-captures/comparison-news-desktop.png`
- Requested desktop viewport: 1440 × 900.
- Requested mobile viewport: 390 × 844.
- State: initial homepage, initial News page, and mobile navigation expanded.
- Scope: foundational Astro UI rather than an exact clone; the user explicitly
  requested a basic framework because the homepage will be redesigned later.

## Findings

- No actionable P0, P1, or P2 issues remain.
- [P3] The homepage hero and News masthead are intentionally more explicit than
  the reference WordPress layouts.
  - Location: homepage hero and `/news` page hero.
  - Evidence: the normalized comparisons show the reference's restrained/blank
    homepage slider state and event-led News masthead beside the implementation's
    stable editorial hero treatment.
  - Impact: acceptable within the agreed foundation-only scope; the shared logo,
    navigation, green palette, image language, and content hierarchy remain grounded
    in the source.
  - Follow-up: revisit these surfaces during the planned homepage redesign.

## Required fidelity surfaces

- Fonts and typography: headings and navigation use a strong sans-serif hierarchy;
  body text now consistently uses the configured Open Sans/system sans stack. Line
  length and wrapping remain readable at desktop and mobile sizes.
- Spacing and layout rhythm: sticky header, section spacing, cards, News list, and
  form align to a consistent container. Browser checks found no horizontal overflow
  at 390 px.
- Colors and visual tokens: the implementation retains MOCA's green, white, soft
  green, and dark green/charcoal balance, with accessible foreground contrast.
- Image quality and asset fidelity: logo, homepage, case, and News imagery were
  copied from assets observed on the source site and are served locally. No visible
  source assets are hotlinked, approximated with CSS drawings, or replaced by
  placeholders.
- Copy and content: navigation labels and section names match the requested
  structure. News entries are deliberately a small presentation sample until the
  separate content-import task.

## Focused-region comparison

A separate crop was not needed for this foundation pass: the navigation, logo,
hero typography, News list structure, imagery, and sidebar are all legible in the
normalized full-view comparisons. Mobile navigation has its own focused screenshot
in `qa-captures/home-mobile-menu.png`.

## Comparison history

### Pass 1

- Earlier finding [P2]: body text and navigation inherited the browser's Times
  default because a broad `font: inherit` rule also targeted `body`.
- Fix made: removed `body` from that reset so the configured Open Sans/system sans
  stack applies across the page.
- Post-fix evidence: `qa-captures/home-desktop-viewport.png` and browser-computed
  styles both show the corrected sans-serif stack.

### Pass 2

- Compared the updated homepage and News page against the source in
  `qa-captures/comparison-home-desktop.png` and
  `qa-captures/comparison-news-desktop.png`.
- No actionable P0/P1/P2 differences remain within the agreed foundation-only
  scope.

## Interaction and runtime checks

- Header News navigation reaches `/news`.
- From `/news`, Contact reaches `/#contact`.
- Mobile Menu expands with `aria-expanded="true"` and exposes all six requested
  links.
- Contact form validation and submission run; without secrets it returns the
  expected `.env.example` configuration message.
- Desktop and mobile pages were rendered in the in-app browser.
- Browser console errors and warnings checked: none.
- `npm run build`: passed with 0 Astro errors, warnings, or hints.

## Implementation checklist

- [x] Astro initialized with strict TypeScript.
- [x] Homepage anchor sections created.
- [x] `/news` route created.
- [x] Responsive mobile navigation created.
- [x] Configurable contact mail endpoint and `.env.example` created.
- [x] Source assets localized.
- [x] Desktop and mobile browser checks completed.

## Follow-up polish

- Replace the sample News data with the future scraping/import pipeline.
- Rework the homepage hero and case-story presentation during the planned redesign.

final result: passed
