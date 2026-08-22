# Utils

Shared utilities: logging, URL resolution, rate limiting, and text sanitization.

**Parent:** repository root [`AGENTS.md`](../../AGENTS.md) owns change protocol, Module integrity (_frozen_ lock), TypeScript, security, product language, testing, and commit gates. This guide owns local mechanics only.

## Change protocol

1. **Route.** Read the parent guide and this file. Store endpoint sanitization prefers `@86d-app/core/sanitize` per the parent security section.
2. **Implement** using the local patterns below.
3. **Verify.** Focused package tests while iterating. Full pre-commit gates live in the parent guide. After `modules/` changes, prove `bun run generate:modules -- --frozen` from repo root.
   - Done when every required parent gate for the _slice_ is _green_.

## Structure

```
src/
  logger.ts      Winston logger with JSON + console transports
  url.ts         Base URL resolution (browser, Vercel, localhost)
  rate-limit.ts  In-memory sliding-window rate limiter
  sanitize.ts    HTML tag stripping and whitespace normalization
```

## Import paths

No barrel export — import each utility via its own path.

| Path | Key exports |
|---|---|
| `utils/logger` | `logger` — Winston logger instance |
| `utils/url` | `getBaseUrl()` — resolves store base URL |
| `utils/rate-limit` | `createRateLimiter(options)` — `RateLimiter` with `.check(key)` |
| `utils/sanitize` | `stripTags(input)`, `normalizeWhitespace(input)`, `sanitizeText(input)` |

## Patterns

- `logger` reads `LOG_LEVEL` from env (default `"info"`); JSON with timestamps and colorized console
- `getBaseUrl()` priority: `window.location.origin` > `NEXT_PUBLIC_STORE_URL` > `VERCEL_URL` > `localhost:PORT`
- `createRateLimiter` is in-memory (Map-based) — resets on process restart; not for distributed use. Expired entries sweep on each check (at most once per window) to bound memory
- `sanitizeText` = `stripTags` + `normalizeWhitespace`

## Gotchas

- Rate limiter state is per-process — does not persist across restarts or share between instances
- `stripTags` removes `<script>` and `<style>` blocks (including content), then remaining HTML tags
- `getBaseUrl()` declares `window` type inline for browser and server contexts
