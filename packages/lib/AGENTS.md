# Lib

Shared platform libraries for carrier tracking, webhook delivery, LLM content rendering, and notification settings.

## Structure

```
src/
  carrier-tracking.ts       Tracking URL generation for major carriers
  webhook-delivery.ts       Webhook payload building, HMAC signing, HTTP delivery
  llms-content.ts           LLM-friendly markdown rendering of store content
  notification-settings.ts  Notification event type definitions and settings parsing
```

## Import paths

| Path | Key exports |
|---|---|
| `lib/carrier-tracking` | `getTrackingUrl(carrier, trackingNumber)` |
| `lib/webhook-delivery` | `WEBHOOK_EVENT_TYPES`, `WebhookEventType`, `buildWebhookPayload`, `deliverWebhook` |
| `lib/llms-content` | `LlmsProduct`, `LlmsCollection`, `LlmsBlogPost`, `LlmsFullContent`, `renderLlmsFullMarkdown` |
| `lib/notification-settings` | `NOTIFICATION_EVENT_TYPES`, `NotificationEventType`, `parseNotificationSettings`, `isEventEnabled` |

## Key details

- **No barrel export** — each file is imported individually via its export path
- `getTrackingUrl` supports UPS, FedEx, USPS, DHL — returns `null` for unknown carriers
- `deliverWebhook` signs payloads with HMAC-SHA256, sends with 10s timeout, returns `DeliveryResult`
- `buildWebhookPayload` generates a UUID `id` and ISO timestamp per payload
- Webhook signature is sent in `X-Webhook-Signature` header
- `renderLlmsFullMarkdown` produces markdown with products, collections, and blog posts
- `parseNotificationSettings` safely parses unknown input into typed settings
- `isEventEnabled` defaults to `true` if no event-specific override exists

## Gotchas

- No external dependencies — uses Node.js `crypto` and global `fetch`
- `getWebhookDeliveryByHash` is a stub that always returns `null`
