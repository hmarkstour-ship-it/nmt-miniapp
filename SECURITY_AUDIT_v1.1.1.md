# NMT v1.1.1 Security Hardening

## Closed in this build

- Telegram WebApp `initData` integrity + `auth_date` freshness check.
- Timing-safe Telegram HMAC comparison.
- Telegram auth middleware on user-data/training/NMT/AI/report endpoints.
- Server-side training answer grading; client `isCorrect` is no longer trusted.
- Per-IP and per-Telegram-ID rate limits, including tighter AI limits.
- Admin access locked to `ADMIN_TELEGRAM_IDS` **and** password.
- Proxy-aware IP handling through Express `trust proxy` / `req.ip`.
- CORS allowlist instead of wildcard.
- Security headers and frontend CSP.
- Safer SVG handling with allowlisted DOM parsing and Shadow DOM isolation.
- User reports mark questions for review instead of allowing 3 accounts to remotely disable an item.
- Public engine metadata reduced.
- Supabase RLS/revoke migration included.
- Optional verified Postgres TLS CA support included.

## Requires deployment configuration

1. Set `ADMIN_TELEGRAM_IDS` on Render.
2. Set exact `CORS_ALLOWED_ORIGINS` for the Render Static Site.
3. Run `supabase_security_v1.1.1.sql` in Supabase SQL Editor.
4. For full Postgres certificate verification, set `DATABASE_SSL_CA_BASE64` from the Supabase CA certificate.

## Residual / next hardening steps

- The current runtime database connection still performs schema migrations at startup, so its DB role remains more privileged than an ideal production runtime role. A later release should move migrations to a separate deploy step and use a least-privilege DB role for normal requests.
- Training payloads still contain the local answer key used for instant UX feedback. Server-side statistics cannot be forged merely by sending `isCorrect`, but a determined user can inspect the client payload and intentionally submit the right option. For tamper-resistant learning analytics, introduce one-time server-issued question delivery IDs and return the answer key only after submission.
- In-memory rate limits apply per running Render instance. If the service scales to multiple instances, move rate-limit counters to Redis/Upstash or another shared store.
- Dependency CVE status must be checked in the full repository with `npm audit`, because this drop-in archive does not contain `package.json` / `package-lock.json`.
