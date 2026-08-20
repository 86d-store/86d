<p align="center">
  <a href="https://86d.app">
    <img src="https://86d.app/logo" height="96" alt="86d" />
  </a>
</p>

<p align="center">
  Dynamic Commerce
</p>

<p align="center">
  <a href="https://x.com/86d_app"><strong>X</strong></a> ·
  <a href="https://www.linkedin.com/company/86d"><strong>LinkedIn</strong></a>
</p>
<br/>

> [!WARNING]
> This project is under active development and is not ready for production use. Please proceed with caution. Use at your own risk.

# Utils

Shared utility package for the 86d platform. Provides structured logging, URL resolution, in-memory rate limiting, and text sanitization.

## Installation

```sh
npm install utils
```

## Usage

### Logger

```ts
import { logger } from "utils/logger";

logger.info("Server started", { port: 3000 });
logger.error("Request failed", { error });
```

Configured with JSON formatting, timestamps, and colorized console output. Set `LOG_LEVEL` env var to control verbosity (default: `"info"`).

### URL Resolution

```ts
import { getBaseUrl } from "utils/url";

const url = getBaseUrl();
// In browser: window.location.origin
// On Vercel: https://<VERCEL_URL>
// Fallback: http://localhost:3000
```

Resolution priority:
1. `window.location.origin` (browser)
2. `NEXT_PUBLIC_STORE_URL` env var
3. `VERCEL_URL` env var (prefixed with `https://`)
4. `http://localhost:<PORT>` (default 3000)

### Rate Limiting

```ts
import { createRateLimiter } from "utils/rate-limit";

const limiter = createRateLimiter({
  limit: 100,    // max requests
  window: 60000, // per 60 seconds
});

const result = limiter.check("user-123");
if (!result.allowed) {
  // rate limited — retry after result.resetAt
}
```

### Text Sanitization

```ts
import { sanitizeText, stripTags, normalizeWhitespace } from "utils/sanitize";

sanitizeText("<p>Hello  <b>world</b></p>");  // "Hello world"
stripTags("<script>alert('xss')</script>Hi"); // "Hi"
normalizeWhitespace("  too   many   spaces "); // "too many spaces"
```

## API Reference

### `logger`

Winston logger instance with JSON format, error stack traces, and colorized console transport.

### `getBaseUrl(): string`

Returns the base URL for the current environment.

### `createRateLimiter(options): RateLimiter`

Creates an in-memory rate limiter.

| Option | Type | Description |
|---|---|---|
| `limit` | `number` | Maximum number of requests per window |
| `window` | `number` | Window duration in milliseconds |

#### `RateLimiter.check(key): RateLimitResult`

| Field | Type | Description |
|---|---|---|
| `allowed` | `boolean` | Whether the request is within limits |
| `remaining` | `number` | Remaining requests in current window |
| `resetAt` | `number` | Timestamp (ms) when the window resets |

### `stripTags(input): string`

Removes all HTML tags, including `<script>` and `<style>` blocks with their content.

### `normalizeWhitespace(input): string`

Collapses consecutive whitespace to single spaces and trims.

### `sanitizeText(input): string`

Combines `stripTags` and `normalizeWhitespace` for safe plain-text output.

## Notes

- Each utility is imported via its own path (no barrel export).
- The rate limiter is in-memory and per-process. It does not persist across restarts or share state between instances. Expired entries are automatically swept to prevent unbounded memory growth.
- The logger uses [Winston](https://github.com/winstonjs/winston).
