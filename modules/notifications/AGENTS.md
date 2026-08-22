# Notifications Module

In-app and email notification system with templates, batch send, priority levels, event emission, and per-customer preferences.

**Parent:** repository root [`AGENTS.md`](../../AGENTS.md) owns change protocol, Module integrity (_frozen_ lock), TypeScript, security, product language, testing, and commit gates. This guide owns local mechanics only.

## Change protocol

1. **Route.** Read the parent guide, `../../../prd/contexts/store-runtime/module-system.md` when storage or cross-Module contracts change, and this file.
2. **Implement** within the Module source shape and patterns below.
3. **Verify.** From the repository root after any Module source change: `bun run generate:modules`, then prove `bun run generate:modules -- --frozen`. Run this Module's focused tests.
   - Done when the frozen check is _green_ and touched Module tests pass.

## Structure

```
src/
  index.ts          Factory: notifications(options?) => Module
  intents.ts        Persistence-only durable intent/idempotency foundation
  schema.ts         Zod models: notification, template, preference
  service.ts        NotificationsController interface + types
  service-impl.ts   NotificationsController implementation
  admin/
    components/
      index.tsx                           Admin component exports
      notification-list.tsx               Notification list table
      notification-list.mdx               Admin template
      notification-composer.tsx            Compose notification UI
      notification-composer.mdx            Admin template
      notification-template-list.tsx       Template management UI
      notification-template-list.mdx       Admin template
    endpoints/
      index.ts                   Endpoint map
      delivery-containment.ts    Shared external-delivery 503 response
      list-notifications.ts      GET  /admin/notifications
      create-notification.ts     POST /admin/notifications/create
      get-notification.ts        GET  /admin/notifications/:id
      update-notification.ts     POST /admin/notifications/:id/update
      delete-notification.ts     POST /admin/notifications/:id/delete
      stats.ts                   GET  /admin/notifications/stats
      bulk-delete.ts             POST /admin/notifications/bulk-delete
      batch-send.ts              POST /admin/notifications/batch-send
      list-preferences.ts       GET  /admin/notifications/preferences
      get-customer-preferences.ts    GET  /admin/notifications/preferences/:customerId
      update-customer-preferences.ts POST /admin/notifications/preferences/:customerId/update
      delete-customer-preferences.ts POST /admin/notifications/preferences/:customerId/delete
      list-templates.ts          GET  /admin/notifications/templates
      create-template.ts         POST /admin/notifications/templates/create
      get-template.ts            GET  /admin/notifications/templates/:id
      update-template.ts         POST /admin/notifications/templates/:id/update
      delete-template.ts         POST /admin/notifications/templates/:id/delete
      send-from-template.ts      POST /admin/notifications/templates/send
  store/
    components/
      _hooks.ts                  Client-side hooks
      _utils.ts                  Utility helpers
      index.tsx                  Store component exports
      notification-bell.tsx      Bell icon with unread badge
      notification-bell.mdx      Store template
      notification-inbox.tsx     Full inbox view
      notification-inbox.mdx     Store template
      notification-preferences.tsx  Preference toggles
      notification-preferences.mdx  Store template
    endpoints/
      index.ts                   Endpoint map
      list-my-notifications.ts   GET  /notifications
      get-notification.ts        GET  /notifications/:id
      mark-read.ts               POST /notifications/:id/read
      delete-notification.ts     POST /notifications/:id/delete
      mark-all-read.ts           POST /notifications/read-all
      unread-count.ts            GET  /notifications/unread-count
      get-preferences.ts         GET  /notifications/preferences
      update-preferences.ts      POST /notifications/preferences/update
      resend-webhook.ts          POST /notifications/webhook/resend
      twilio-webhook.ts          POST /notifications/webhook/twilio
```

## Options

```ts
NotificationsOptions {
  maxPerCustomer?: string  // max stored per customer before auto-cleanup, default "500"
}
```

## Data models

- **notification**: id, customerId, type, channel, priority (low|normal|high|urgent), title, body, actionUrl?, metadata, read, readAt?, createdAt
- **template**: id, slug, name, type, channel, priority, titleTemplate, bodyTemplate, actionUrlTemplate?, variables (string[]), active, createdAt, updatedAt
- **preference**: id, customerId, orderUpdates, promotions, shippingAlerts, accountAlerts, updatedAt
- **notificationIntent**: deterministic idempotency identity, durable source-event reference, template key, one shopper recipient, delivery mode, immutable request fingerprint, Connection reference, bounded payload, state, attempt count, provider acceptance reference, and accepted recipient units

`notificationIntentLock` serializes creation for one deterministic intent ID. The
intent store rejects reuse of an idempotency key for a different request and
does not dispatch delivery.

## Events

The module emits these events via `ScopedEventEmitter`:

- `notifications.created` — `{ notificationId, customerId, type, priority }` — on every `create()` call
- `notifications.read` — `{ notificationId, customerId }` — when a notification is first marked as read (idempotent: not re-emitted)
- `notifications.all_read` — `{ customerId, count }` — when `markAllRead()` processes >0 notifications

Events are fire-and-forget (`void events.emit(...)`) — failures do not break operations.

Checkout, Order, Payment, Shipment, and Return events are deliberately not
consumed through this in-memory bus. Their future consumer must receive durable
outbox facts and create a `notificationIntent` before any local-provider or
managed-gateway attempt.

## Patterns

- Controller accepts `events?: ScopedEventEmitter` and `options?: { maxPerCustomer?: number }` parameters
- Literal Resend/Twilio options remain available to standalone and BYO Stores. Managed provisioning does not supply an upstream provider key.
- The additive notification-intent store is persistence-only. Gateway routing, workload scope, Connection/entitlement enforcement, delivery retries, provider acceptance reconciliation, and metering are not activated yet.
- Registered Admin create and batch routes only create `in_app` notifications. Email and `both` requests fail with `NOTIFICATION_DELIVERY_DURABILITY_REQUIRED` before persistence or provider delivery.
- Registered template sends validate a stored template snapshot and only execute `in_app` templates. External templates fail closed before creating notifications.
- Resend and Twilio callbacks fail closed without verification configuration, reject missing or invalid signatures, and return a retryable durability-required response after valid verification. They do not mutate the delivery projection until durable provider receipts exist.
- `maxPerCustomer` enforcement happens after every `create()` — oldest notifications are auto-deleted when limit exceeded
- Templates use `{{variable}}` interpolation — unknown variables are left as-is
- The registered `sendFromTemplate` route creates one in-app notification per customer from a validated active in-app template
- The registered `batchSend` route creates identical in-app notifications for up to 500 customers
- Preferences are lazy-created: defaults returned without persisting until first update
- Admin can manage customer preferences (view, update, reset/delete)
- Stats include both `byType` and `byPriority` breakdowns
- Template slugs must be unique (lowercase alphanumeric with hyphens)
- Inactive templates cannot be used to send notifications
- Store delete endpoint verifies ownership before deletion (returns 404 if not owner)
