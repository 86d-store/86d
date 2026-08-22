# Lib

Shared platform libraries: carrier tracking, webhook delivery, LLM content rendering, and notification settings.

**Parent:** repository root [`AGENTS.md`](../../AGENTS.md) owns change protocol, Module integrity (_frozen_ lock), TypeScript, security, product language, testing, and commit gates. This guide owns local mechanics only.

## Change protocol

1. **Route.** Read the parent guide and this file.
2. **Implement** using the local patterns below.
3. **Verify.** Focused package tests while iterating. Full pre-commit gates live in the parent guide. After `modules/` changes, prove `bun run generate:modules -- --frozen` from repo root.
   - Done when every required parent gate for the _slice_ is _green_.

## Structure

```
src/
  carrier-tracking.ts       Tracking URL generation for major carriers
  webhook-delivery.ts       Webhook payload building, HMAC signing, HTTP delivery
  llms-content.ts           LLM-friendly markdown rendering of store content
  notification-settings.ts  Notification event type definitions and settings parsing
```

## Import paths

No barrel export — import each file via its export path.

| Path | Key exports |
|---|---|
| `lib/carrier-tracking` | `getTrackingUrl(carrier, trackingNumber)` |
| `lib/webhook-delivery` | `WEBHOOK_EVENT_TYPES`, `WebhookEventType`, `buildWebhookPayload`, `deliverWebhook` |
| `lib/llms-content` | `LlmsProduct`, `LlmsCollection`, `LlmsBlogPost`, `LlmsFullContent`, `renderLlmsFullMarkdown` |
| `lib/notification-settings` | `NOTIFICATION_EVENT_TYPES`, `NotificationEventType`, `parseNotificationSettings`, `isEventEnabled` |

## Patterns

- `getTrackingUrl` supports UPS, FedEx, USPS, DHL — returns `null` for unknown carriers
- `deliverWebhook` signs with HMAC-SHA256, 10s timeout, returns `DeliveryResult`; signature header `X-Webhook-Signature`
- `buildWebhookPayload` generates a UUID `id` and ISO timestamp per payload
- `renderLlmsFullMarkdown` produces markdown with products, collections, and blog posts
- `parseNotificationSettings` safely parses unknown input into typed settings
- `isEventEnabled` defaults to `true` when no event-specific override exists

## Gotchas

- No external dependencies — Node.js `crypto` and global `fetch`
- `getWebhookDeliveryByHash` is a stub that always returns `null`
