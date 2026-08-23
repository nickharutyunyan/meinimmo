# Habitat

An AI-assisted German residential-property assessment app. It validates listing links and Exposé PDFs before analysis, creates a concise buyer-focused report, and provides a persistent share link.

## Run locally

1. Copy `.env.example` to `.env` and set `OPENROUTER_API_KEY` locally. Never commit it.
2. Run `npm start`.
3. Open `http://localhost:3000`.

## Deployment

Build with `docker build -t habitat .` and run with a persistent volume mounted at `/app/data`. Configure `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `APP_URL`, and `PORT` as deployment secrets/environment variables.

The bundled JSON report store is appropriate for a single-instance MVP with persistent disk. Before horizontally scaling, replace it with a managed database and add authenticated users plus Stripe webhooks for Pro/Ultra entitlements.
