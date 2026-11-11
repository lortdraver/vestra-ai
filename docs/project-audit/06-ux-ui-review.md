# 06 — UX / UI Review

Scope and limits: this review is based on the source code (components, CSS tokens, copy, responsive classes). **The app was not run in a browser for this audit**, so visual polish, animation quality and real mobile rendering are inferred, not observed. A hands-on pass on iPhone Safari and Android Chrome is recommended before acting on the visual items.

## Visual identity versus the brief

The brief asks for black typography, cream backgrounds, elegant type and minimalism. `app/globals.css` already does this deliberately:

- Palette: "Editorial fashion palette: ivory, ink, camel", with `--background: oklch(0.977 0.005 85)` (ivory), `--foreground` near-black warm ink, and a camel `--accent`.
- Type: Inter for UI and Playfair Display for headings (`app/layout.tsx`), both with Cyrillic subsets, which is needed for RU and AZ.
- Radius 0.5 rem. No gradients appear in the tokens.

**Verdict:** the foundation matches the brief. The risk is in the screens, not the tokens.

## Observed issues

### First impression and onboarding

- **The landing page is text only** (`app/page.tsx`): eyebrow, headline, paragraph, two buttons. A fashion product with no clothing imagery on its front door undersells the main value (clean cut-out garments and generated outfits). Add a hero that shows a real before/after (photo → cut-out → outfit) and a three-step "how it works".
- An onboarding explainer exists (M4.5), but the **critical activation path** is "upload at least one top, one bottom and one pair of shoes, then generate an outfit". The stylist returns `insufficient_wardrobe` until then. Make that path explicit with a guided "Add your first 5 items" checklist and progress on the wardrobe page.
- The upload pipeline is slow and synchronous (doc 04 H2), so the "processing modal" with a progress ring is covering real waiting time. Moving processing to a background job and showing the item card immediately with a "processing" shimmer would feel much faster.

### Trust breakers (fix first; they are cheap)

- **Dead buttons on the account page:** Edit profile, Change language and Delete account do nothing (`components/account/account-actions.tsx`). A destructive button that does nothing, next to copy claiming deletion is in place, is the worst kind of dead UI.
- **Favourites on wardrobe cards reset on reload** (client-only state). Users will notice.
- **Items stuck "analysing" forever** (15% of items in the DB) show a permanent spinner with no retry.
- **Usage meters** for analyses and background removals read from an empty table.

### Navigation and information architecture

- Dashboard sections: Wardrobe, Stylist, Outfits, Planner, Account, Subscription, plus Admin. Seven areas is a lot for an MVP. Consider merging _Outfits_ into _Stylist_ (generate, then save into the same space) and _Subscription_ into _Account_, leaving 4 primary tabs: **Wardrobe · Style me · Plan · Me**.
- The dashboard layout stacks the header, an email-verification banner and a `SubscriptionOverview` strip above every page (`app/dashboard/layout.tsx`). On mobile this pushes content below the fold. Show the subscription strip only on relevant pages or when a limit is near.

### Mobile

- There is clear effort here: `viewportFit: 'cover'`, safe-area padding, a dedicated `lib/ui/responsive.ts`, 18 responsive tests, and several commits fixing iPhone Safari layout and the header. But the tests are mostly class-string assertions, not rendering tests.
- The footer gets `pb-[calc(env(safe-area-inset-bottom)+6.75rem)]` on mobile, which suggests a fixed bottom bar. Verify it does not cover the last row of the wardrobe grid on short phones.
- The camera capture path matters most on mobile. Confirm the upload input offers `capture` and handles HEIC from iPhones. Accepted types are only jpeg, png and webp, and the client compression is expected to convert. Verify on a real device.

### Accessibility

- Few ARIA attributes in the large clients (wardrobe 13, stylist 3, planner 4). Quick wins: label icon-only buttons (favourite, delete, "I wore this"), provide `alt` text from the item name plus colour, keep visible focus rings (`outline-ring/50` exists), and make toasts polite live regions.
- Check contrast of `--muted-foreground` (oklch 0.5) on ivory for small text, and of camel `--accent` text, such as the landing eyebrow, against the background. Camel on ivory often falls below 4.5:1 at small sizes.

### Localisation

- AZ is the default locale, which is good for the home market. Copy is spread across `dictionaries.ts`, `*/copy.ts` and inline escapes in `app-header.tsx`. Consolidate it so translators have one source.

### SEO and public pages

- Public pages exist (pricing, faq, support, legal) and metadata is localised. There is no `sitemap.ts`, `robots.ts` or Open Graph image. Add them when marketing starts.

## Priority UX fixes

1. Wire up or hide every dead control (account actions).
2. Persist favourites, or hide the heart.
3. Recover stuck analyses and show a retry on failed or stuck items.
4. Add an activation checklist for the first outfit.
5. Add a visual landing hero with real product imagery.
6. Simplify navigation to 4 tabs on mobile.
