# Review a House

An AI-assisted German residential-property report app. It validates listing links and Exposé PDFs before analysis, creates a concise buyer-focused report, and provides persistent share and comparison links.

Listing photos on a report are remote thumbnail URLs only. The app never downloads or stores image bytes. Hosts the browser may load are `LISTING_IMAGE_HOSTS` in `lib/listing-image-hosts.ts`, and that same list is the only listing-photo addition to the Content-Security-Policy `img-src` directive. Adding photos from another portal requires an update to that allowlist. If a portal blocks hotlinking, the thumbnail strip hides. Photo URLs are stored and rendered exactly as the listing publishes them, including `sig` and `exp`. The app does not strip those parameters or refresh the links in the background; a new import is what replaces them. At view time, a photo whose own `exp` (unix seconds) has passed is omitted, and the strip hides when none remain. URLs without `exp` are shown as stored. `facts.photosExpireAt` is the earliest of those expiry times, as an ISO timestamp.

## Local Cloudflare development

1. Copy `.dev.vars.example` to `.dev.vars`.
2. Put `OPENROUTER_API_KEY` in `.dev.vars`. The file is ignored by git. `OPENROUTER_MODEL` defaults to OpenRouter's zero-cost `openrouter/free` router.
3. Initialize both local D1 databases with `npm run db:migrate:local` and `npm run auth-db:migrate:local`. Migration `0004_geocode_cache.sql` stores Nominatim results for 30 days and the shared one-request-per-second slot. Apply it with the other D1 migrations.
4. Run `npm run dev` for fast Next.js development, or `npm run preview` to test inside the Workers runtime.

## First Cloudflare deployment

1. Authenticate without placing credentials in the repository: `npx wrangler login`.
2. Apply both production schemas: `npm run db:migrate:remote` and `npm run auth-db:migrate:remote`.
3. Add the API key interactively: `npx wrangler secret put OPENROUTER_API_KEY`.
4. Deploy with `npm run deploy`.

Never put the OpenRouter key in `.env.example`, `.dev.vars.example`, `wrangler.jsonc`, GitHub Actions YAML, or a command argument. `wrangler secret put` prompts for the value without persisting it in source control.

## Continuous deployment

Connect the GitHub repository in Cloudflare Workers Builds. Use `npm run deploy` as the deploy command. That command builds the Worker, copies prerendered HTML into the asset directory, and then deploys. Configure build-time values in the Cloudflare dashboard; keep runtime credentials as Worker secrets.

There is no GitHub Actions workflow in this repository. `wrangler.jsonc` attaches the Worker to `reviewahouse.com` and `www.reviewahouse.com`, so a successful deploy publishes production. Whether a push to `main` triggers that deploy is set in the Cloudflare dashboard, not in git.

The Armenia helper page downloads `/downloads/reviewahouse-helper.zip`. That file is built by `npm run helper:package`, which `npm run build` runs before `next build`. OpenNext's Cloudflare build invokes `npm run build`, so `npm run deploy` produces the zip without committing it. Packaging is a Node script because the Workers build image includes `unzip` but not `zip`.

D1 is the authoritative store for reports and comparisons. The old `data/*.json` files are no longer used at runtime.

## Re-extract saved reports

Report pages, print pages, Open Graph metadata and the sitemap serve the facts already stored on the report. They do not read archived HTML. The sitemap lists the home, guide and terms URLs only, so a crawler following it never opens `/r/` pages. `robots.txt` disallows `/api/`. An old or missing extraction version is still served, with the score withheld and a notice to re-import.

A visitor re-imports one listing through the normal import form. That is the only request path that parses a listing the visitor just submitted.

To refresh reports already in D1, set a Worker secret of at least 24 characters and call the backfill route. Each call loads at most 5 archived listings, stops once 8 seconds have passed, and saves either the new extraction or a failure marker. A marked failure is not selected again. There is no cron, so this work does not run during ordinary traffic.

```bash
npx wrangler secret put BACKFILL_TOKEN
curl -sS -X POST https://reviewahouse.com/api/reports/backfill \
  -H "Authorization: Bearer $BACKFILL_TOKEN"
```

Repeat until `processed` is an empty array. For local preview, put `BACKFILL_TOKEN` in `.dev.vars` (never commit the value) and POST to that origin. A 401 means the secret is missing, shorter than 24 characters, or the header does not match.

## Static pages and cached reports

Ordinary document requests for the home page, guide, terms, account shell, country landings, sitemap, and robots.txt are the prerendered files copied into Worker assets. Router data, `/api`, comparisons, and print still run in Next.js. The header loads sign-in state in the browser from `/api/auth/me`.

`/r/[id]` and `/de/r/[id]` store their HTML in the Workers cache for the colo that rendered them. The key is the origin, the locale path, the report id, and the Next build id, so a deploy does not keep HTML that points at the previous static chunks. Saving or replacing the report deletes the current build's entries in that colo. The browser is sent `private, no-store`, and a stored entry expires after one day, which covers a colo the delete did not reach. Signed listing photos stay in that HTML; the browser drops a photo after its own `exp`. Print stays uncached because each print reads the current mortgage rate.

With `npm run preview` or `npx wrangler dev --port 8787` already running, `node scripts/measure-routes.mjs` prints time to first byte per route. `wrangler dev` reports wall time. Workers CPU time appears in production tail logs.

## Accounts and billing

Personal account, credential, session and billing records live in the dedicated `AUTH_DB` D1 database. Property report content remains in `DB`; the private database only keeps opaque report IDs when a signed-in user opens or creates a report. Passwords are stored as salted PBKDF2 hashes and session cookies contain opaque tokens whose hashes are stored server-side.

New purchases are hidden until digest-based pricing exists. `PAID_PLANS_ENABLED` defaults to off (`false` in `wrangler.jsonc`). Reports stay free, the billing portal still opens for an existing subscriber, and Stripe webhooks still record renewals and cancellations. Set `PAID_PLANS_ENABLED` to `true` to offer Pro, Ultra and the day pass again. Leave `PAYMENTS_ENABLED` and the Stripe secrets in place while plans are hidden.

Create these recurring Stripe prices in EUR before enabling subscriptions:

- `STRIPE_PRICE_DAY_PASS`: €5 one-time payment
- `STRIPE_PRICE_PRO`: €10 recurring monthly
- `STRIPE_PRICE_ULTRA`: €20 recurring monthly

The €5 one-day pass is created directly as a one-time Checkout line item, so it does not need a separate Stripe Price ID. Create a Stripe webhook for `/api/billing/webhook` with `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `customer.subscription.created`, `customer.subscription.updated` and `customer.subscription.deleted`. Add every secret interactively with `npx wrangler secret put NAME`; never put secret values in this repository.

For Google sign-in, create an OAuth 2.0 web client and register these production redirect URIs:

- `https://reviewahouse.com/api/auth/google/callback`
- `https://www.reviewahouse.com/api/auth/google/callback`

Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` as Worker secrets. For local Google sign-in, also register `http://localhost:3000/api/auth/google/callback` (or the port used locally).
