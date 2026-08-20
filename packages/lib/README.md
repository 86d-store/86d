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

# Lib

Shared platform libraries for the 86d commerce platform. Provides carrier tracking URL generation, webhook delivery, LLM content rendering, and notification settings management.

## Installation

```sh
npm install lib
```

## Usage

### Carrier Tracking

```ts
import { getTrackingUrl } from "lib/carrier-tracking";

const url = getTrackingUrl("ups", "1Z999AA10123456784");
// "https://www.ups.com/track?tracknum=1Z999AA10123456784"
```

Supported carriers: `ups`, `fedex`, `usps`, `dhl`. Returns `null` for unknown carriers.

### Webhook Delivery

```ts
import {
  buildWebhookPayload,
  deliverWebhook,
} from "lib/webhook-delivery";

const payload = buildWebhookPayload("order.placed", "orders", {
  orderId: "ord_123",
});

const result = await deliverWebhook(
  "https://example.com/webhook",
  "whsec_secret",
  payload,
);

console.log(result.success, result.statusCode);
```

### LLM Content Rendering

```ts
import { renderLlmsFullMarkdown } from "lib/llms-content";

const markdown = renderLlmsFullMarkdown(
  { products: [...], collections: [...], blogPosts: [...] },
  "My Store",
  "https://mystore.com",
);
```

### Notification Settings

```ts
import {
  parseNotificationSettings,
  isEventEnabled,
} from "lib/notification-settings";

const settings = parseNotificationSettings(rawConfig);
if (isEventEnabled(settings, "order.placed")) {
  // send notification
}
```

## API Reference

### `getTrackingUrl(carrier, trackingNumber): string | null`

Returns a tracking URL for the given carrier and tracking number. Returns `null` if the carrier is not recognized.

### `buildWebhookPayload(type, source, data): WebhookPayload`

Creates a webhook payload with a UUID, timestamp, event type, source, and arbitrary data.

### `deliverWebhook(url, secret, payload): Promise<DeliveryResult>`

Delivers a webhook via HTTP POST with HMAC-SHA256 signature. Has a 10-second timeout.

| Field | Type | Description |
|---|---|---|
| `success` | `boolean` | Whether the response was 2xx |
| `statusCode` | `number \| null` | HTTP status or null on network error |
| `response` | `string \| null` | Response body (truncated to 1000 chars) |
| `attempts` | `number` | Number of delivery attempts |
| `duration` | `number` | Round-trip time in milliseconds |

### `parseNotificationSettings(raw): NotificationSettings`

Safely parses unknown input into a typed `NotificationSettings` object with `fromAddress`, `adminEmail`, and `events`.

### `isEventEnabled(settings, eventType): boolean`

Returns whether a notification event type is enabled. Defaults to `true` if no override is set.

## Webhook Event Types

`order.placed`, `order.shipped`, `order.delivered`, `order.cancelled`, `order.completed`, `order.refunded`, `payment.failed`, `subscription.created`, `subscription.cancelled`, `subscription.updated`, `customer.created`, `inventory.low`, `review.created`

## Notes

- No external dependencies — uses Node.js `crypto` for HMAC signing and global `fetch` for HTTP.
- Each module is imported individually (no barrel export).
- Webhook payloads include an `X-Webhook-Signature` header and an `X-Webhook-Id` header.
