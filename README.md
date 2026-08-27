# Review a House

An AI-assisted German residential-property report app. It validates listing links and Exposé PDFs before analysis, creates a concise buyer-focused report, and provides persistent share and comparison links.

## Local Cloudflare development

1. Copy `.dev.vars.example` to `.dev.vars`.
2. Put `OPENROUTER_API_KEY` in `.dev.vars`. The file is ignored by git. `OPENROUTER_MODEL` defaults to OpenRouter's zero-cost `openrouter/free` router.
3. Initialize both local D1 databases with `npm run db:migrate:local` and `npm run auth-db:migrate:local`.
4. Run `npm run dev` for fast Next.js development, or `npm run preview` to test inside the Workers runtime.

## First Cloudflare deployment

1. Authenticate without placing credentials in the repository: `npx wrangler login`.
2. Apply both production schemas: `npm run db:migrate:remote` and `npm run auth-db:migrate:remote`.
3. Add the API key interactively: `npx wrangler secret put OPENROUTER_API_KEY`.
4. Deploy with `npm run deploy`.

Never put the OpenRouter key in `.env.example`, `.dev.vars.example`, `wrangler.jsonc`, GitHub Actions YAML, or a command argument. `wrangler secret put` prompts for the value without persisting it in source control.

## Continuous deployment

Connect the GitHub repository in Cloudflare Workers Builds. Use `npm run deploy` as the deploy command. Configure build-time values in the Cloudflare dashboard; keep runtime credentials as Worker secrets.

D1 is the authoritative store for reports and comparisons. The old `data/*.json` files are no longer used at runtime.

## Accounts and billing

Personal account, credential, session and billing records live in the dedicated `AUTH_DB` D1 database. Property report content remains in `DB`; the private database only keeps opaque report IDs when a signed-in user opens or creates a report. Passwords are stored as salted PBKDF2 hashes and session cookies contain opaque tokens whose hashes are stored server-side.

Create these recurring Stripe prices in EUR before enabling subscriptions:

- `STRIPE_PRICE_DAY_PASS`: €5 one-time payment
- `STRIPE_PRICE_PRO`: €10 recurring monthly
- `STRIPE_PRICE_ULTRA`: €20 recurring monthly

The €5 one-day pass is created directly as a one-time Checkout line item, so it does not need a separate Stripe Price ID. Create a Stripe webhook for `/api/billing/webhook` with `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `customer.subscription.created`, `customer.subscription.updated` and `customer.subscription.deleted`. Add every secret interactively with `npx wrangler secret put NAME`; never put secret values in this repository.

For Google sign-in, create an OAuth 2.0 web client and register these production redirect URIs:

- `https://reviewahouse.com/api/auth/google/callback`
- `https://www.reviewahouse.com/api/auth/google/callback`

Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` as Worker secrets. For local Google sign-in, also register `http://localhost:3000/api/auth/google/callback` (or the port used locally).
