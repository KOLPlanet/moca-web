# Homepage and News Shell Design QA

- Source visual truth: Figma homepage frame `33133:17811`, the supplied News header reference, and the supplied footer reference.
- Implementation reviewed: local Astro homepage and News routes at `http://127.0.0.1:4321/`.
- Viewports checked: desktop `1280 × 720` and mobile `390 × 844`.
- Comparison evidence: `/tmp/qa-header-update-comparison.png`, `/tmp/qa-news-header-update-comparison.png`, and `/tmp/qa-footer-update-comparison.png`.

## Iteration history

1. Compared the Figma frame against the first implementation pass. Corrected the About MOCA copy, presence list, flag assets, glass-panel gradient, column divider, Pulse section copy, Join MOCA card copy/buttons, and footer information architecture.
2. Compared side-by-side crops for About MOCA, The Pulse of MOCA, Join MOCA, and the footer. Removed horizontal page overflow, hid the carousel scrollbar, exposed both carousel controls, and retained disabled-state feedback for the previous control.
3. Verified the carousel advances one card per click, button states update, the responsive layout collapses without horizontal overflow, and the browser console has no errors or warnings.
4. Restored a route-specific News header with a visible active News item while keeping the homepage header transparent over the hero.
5. Compared the homepage header at the top, partial scroll, and solid sticky states; checked the News desktop header and open mobile menu; and verified the app-badge Coming Soon treatment with keyboard focus as well as hover styling.

## Final checklist

- [x] About MOCA uses the supplied long-form copy and five country flag icons.
- [x] About and Join panels use the semi-transparent treatments shown in the design.
- [x] The Pulse of MOCA uses left/right buttons with no visible scrollbar.
- [x] Join MOCA cards use the designed filled and outline button hierarchy.
- [x] Footer copy, navigation groups, app badges, legal row, and privacy-policy destination match the supplied UI.
- [x] Footer Latest News links to `/news`; both app-store badges expose a legible Coming Soon state on hover and focus.
- [x] Homepage header transitions progressively from transparent to white and remains fixed at the viewport top.
- [x] News routes keep the existing white sticky header treatment and expose all six navigation destinations.
- [x] Typography, spacing, color, imagery, copy, active navigation, and responsive menu behavior were reviewed against the supplied references.
- [x] Desktop and mobile layouts have no horizontal page overflow.
- [x] Browser console contains no errors or warnings.
- [x] Astro type-check and production build pass.

## Result

No actionable P0, P1, or P2 visual issues remain. The updated News labels intentionally follow the current homepage anchors so the restored navigation does not point to retired sections.

final result: passed
