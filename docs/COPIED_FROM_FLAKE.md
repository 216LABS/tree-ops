# Copied from Flake

Source: `216LABSSTUFF/flake`, commit `1446483` (Nov 24, 2026). Per docs/SPEC.md section 6.1: security fixes in these
files get ported within 7 days; anything else is optional. Re-decide sharing code after the Davey pilot.

| Here | Flake file | How much changed |
|---|---|---|
| `packages/ui/src/index.tsx` | `packages/ui/src/index.tsx` | Wordmark only |
| `apps/web/app/globals.css` | `apps/web/app/globals.css` | Accent color |
| `apps/web/csp.mjs` | `apps/web/csp.mjs` | None |
| `apps/web/postcss.config.mjs` | same | None |
| `apps/web/lib/shrink-image.ts` | same | Dropped Flake's pin upload helper |
| `apps/web/lib/tokens.ts` | same | Added derived tokens; dropped invite tokens |
| `apps/web/lib/env.ts` | same | Trimmed |
| `apps/web/lib/http.ts` | same | Spec's error shape, idempotency keys, memory-only rate limit |
| `apps/web/lib/auth.ts` | same | Tree roles; postgres.js instead of Drizzle |
| `apps/web/components/outbox.ts` | `apps/web/app/d/[token]/outbox.ts` | Generic scope; photos before actions; `retry` answers |
| `apps/web/components/map-pins.tsx` | `apps/web/components/map-view.tsx` | Pins only, no polygon editing |
| `apps/web/public/sw.js` | `apps/web/public/sw.js` | Crew path; caches signed photo links |
| `apps/web/app/api/tiles/mock/...` | same | None |
| `packages/providers/src/live.ts` (Twilio, Stripe Connect) | `packages/providers/src/live/{sms,payments}.ts` | Checkout instead of SetupIntent; one platform sender |
| `packages/providers/src/mock.ts` (Twilio signature) | `packages/providers/src/mock/sms.ts` | None |
| `scripts/db-start.mjs` | `scripts/db-start.mjs` | Ports 564xx; CLI wrapper |
| `packages/db/src/index.ts` (`withUser`) | `packages/db/src/index.ts` | postgres.js |
| `apps/web/lib/certs.ts` | `packages/core/src/compliance.ts` | Trimmed |

Patterns reused without copying code: append-only records with corrections, hashed photos, link tokens stored only as
HMAC hashes, mock providers that run with no keys, the demo seed and `/dev` pages, the screen rules in Flake's
`docs/DESIGN.md`.

Drift check: `git -C ../flake diff 1446483 -- <flake file>` for any row above.
