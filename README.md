# Review a House

An AI-assisted German residential-property report app. It validates listing links and Exposé PDFs before analysis, creates a concise buyer-focused report, and provides persistent share and comparison links.

## Local Cloudflare development

1. Copy `.dev.vars.example` to `.dev.vars`.
2. Put `OPENROUTER_API_KEY` in `.dev.vars`. The file is ignored by git. `OPENROUTER_MODEL` defaults to OpenRouter's zero-cost `openrouter/free` router.
3. Initialize the local D1 database with `npm run db:migrate:local`.
4. Run `npm run dev` for fast Next.js development, or `npm run preview` to test inside the Workers runtime.

## First Cloudflare deployment

1. Authenticate without placing credentials in the repository: `npx wrangler login`.
2. Apply the production schema: `npm run db:migrate:remote`.
3. Add the API key interactively: `npx wrangler secret put OPENROUTER_API_KEY`.
4. Deploy with `npm run deploy`.

Never put the OpenRouter key in `.env.example`, `.dev.vars.example`, `wrangler.jsonc`, GitHub Actions YAML, or a command argument. `wrangler secret put` prompts for the value without persisting it in source control.

## Continuous deployment

Connect the GitHub repository in Cloudflare Workers Builds. Use `npm run deploy` as the deploy command. Configure build-time values in the Cloudflare dashboard; keep runtime credentials as Worker secrets.

D1 is the authoritative store for reports and comparisons. The old `data/*.json` files are no longer used at runtime.
