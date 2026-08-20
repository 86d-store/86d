# Utils

Shared utility functions for logging, URL resolution, rate limiting, and text sanitization.

## Structure

```
src/
  logger.ts      Winston logger with JSON + console transports
  url.ts         Base URL resolution (browser, Vercel, localhost)
  rate-limit.ts  In-memory sliding-window rate limiter
  sanitize.ts    HTML tag stripping and whitespace normalization
```

## Import paths

| Path | Key exports |
|---|---|
| `utils/logger` | `logger` — Winston logger instance |
| `utils/url` | `getBaseUrl()` — resolves store base URL |
| `utils/rate-limit` | `createRateLimiter(options)` — returns `RateLimiter` with `.check(key)` |
| `utils/sanitize` | `stripTags(input)`, `normalizeWhitespace(input)`, `sanitizeText(input)` |

## Key details

- **No barrel export** — each utility is imported via its own path
- `logger` reads `LOG_LEVEL` from env (default: `"info"`), outputs JSON with timestamps and colorized console
- `getBaseUrl()` priority: `window.location.origin` > `NEXT_PUBLIC_STORE_URL` > `VERCEL_URL` > `localhost:PORT`
- `createRateLimiter` is in-memory (Map-based) — resets on process restart, not suitable for distributed use. Expired entries are automatically swept on each check (at most once per window) to prevent unbounded memory growth.
- `sanitizeText` = `stripTags` + `normalizeWhitespace` (removes script/style tags, all HTML tags, collapses whitespace)

## Gotchas

- Rate limiter state is per-process — does not persist across restarts or share between instances
- `stripTags` removes `<script>` and `<style>` blocks (including content), then all remaining HTML tags
- `getBaseUrl()` declares `window` type inline to work in both browser and server contexts
