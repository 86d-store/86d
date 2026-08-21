<p align="center">
  <a href="https://86d.app">
    <img src="https://86d.app/icon" height="96" alt="86d" />
  </a>
</p>

<p align="center">
  The Modern Foundation for Commerce
</p>

<p align="center">
  <a href="https://x.com/86d_app"><strong>X</strong></a> ·
  <a href="https://www.linkedin.com/company/86d"><strong>LinkedIn</strong></a>
</p>
<br/>

> [!WARNING]
> This project is under active development and is not ready for production use. Please proceed with caution. Use at your own risk. 

📚 **Documentation:** [86d.app/docs/modules/notifications](https://86d.app/docs/modules/notifications)

# Notifications Module

In-app and email notification system with reusable templates, batch sending, priority levels, and per-customer preference management.

> Critical Checkout, Order, Payment, Shipment, and Return communication is
> currently contained: the Module does not send it from the in-memory event
> bus. An additive durable `NotificationIntent` store owns deterministic IDs,
> request fingerprints, template choice, recipient, delivery mode, Connection
> reference, status, and provider-accepted recipient units without activating
> delivery. A durable outbox consumer and managed Communications Gateway remain
> required before these messages can be enabled safely.

## Installation

```sh
npm install @86d-app/notifications
```

## Usage

```ts
import notifications from "@86d-app/notifications";

const module = notifications({
  maxPerCustomer: "500",
});
```

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `maxPerCustomer` | `string` | `"500"` | Maximum notifications stored per customer before auto-cleanup |

Standalone and BYO Stores may configure literal Resend or Twilio credentials
locally. Managed Store provisioning never injects the 86d.app provider key.
The registered Admin delivery routes do not use those credentials yet: external
channels remain contained until durable intent dispatch and provider acceptance
receipts exist. This change does not activate the managed Communications
Gateway.

## Store Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/notifications` | List the current customer's notifications |
| `GET` | `/notifications/unread-count` | Get unread notification count |
| `GET` | `/notifications/preferences` | Get notification preferences |
| `POST` | `/notifications/preferences/update` | Update notification preferences |
| `GET` | `/notifications/:id` | Get a single notification |
| `POST` | `/notifications/:id/read` | Mark a notification as read |
| `POST` | `/notifications/:id/delete` | Delete a notification (ownership verified) |
| `POST` | `/notifications/read-all` | Mark all notifications as read |
| `POST` | `/notifications/webhook/resend` | Verify Resend, then request a retry until durable receipt processing exists |
| `POST` | `/notifications/webhook/twilio` | Verify Twilio, then request a retry until durable receipt processing exists |

## Admin Endpoints

### Notifications

| Method | Path | Description |
|---|---|---|
| `GET` | `/admin/notifications` | List all notifications (filterable by type, priority, read status) |
| `POST` | `/admin/notifications/create` | Create an in-app notification for a customer |
| `GET` | `/admin/notifications/stats` | Get notification statistics (total, unread, byType, byPriority) |
| `POST` | `/admin/notifications/bulk-delete` | Delete multiple notifications |
| `POST` | `/admin/notifications/batch-send` | Create in-app notifications for multiple customers (up to 500) |
| `GET` | `/admin/notifications/:id` | Get a notification |
| `POST` | `/admin/notifications/:id/update` | Update a notification |
| `POST` | `/admin/notifications/:id/delete` | Delete a notification |

### Preferences (Admin)

| Method | Path | Description |
|---|---|---|
| `GET` | `/admin/notifications/preferences` | List all saved customer preferences |
| `GET` | `/admin/notifications/preferences/:customerId` | View a customer's notification preferences |
| `POST` | `/admin/notifications/preferences/:customerId/update` | Update a customer's preferences |
| `POST` | `/admin/notifications/preferences/:customerId/delete` | Reset a customer's preferences to defaults |

### Templates

| Method | Path | Description |
|---|---|---|
| `GET` | `/admin/notifications/templates` | List notification templates |
| `POST` | `/admin/notifications/templates/create` | Create a reusable template |
| `POST` | `/admin/notifications/templates/send` | Create notifications from an active in-app template |
| `GET` | `/admin/notifications/templates/:id` | Get a template |
| `POST` | `/admin/notifications/templates/:id/update` | Update a template |
| `POST` | `/admin/notifications/templates/:id/delete` | Delete a template |

## Controller API

The `NotificationsController` interface is exported for local composition.
Critical commerce communication must originate from durable outbox facts and
notification intents rather than calling this controller from another Module.

Registered Admin endpoints accept only `in_app` delivery. Requests with
`email` or `both`, including templates configured for either external channel,
return `503 NOTIFICATION_DELIVERY_DURABILITY_REQUIRED` before creating a
notification or contacting a provider. Inbox CRUD, template management, and
Customer preference routes remain active.

Signed Resend and Twilio callbacks are deliberately not acknowledged. Missing
verification configuration fails closed, missing or invalid signatures return
`401`, and valid callbacks return retryable `503
NOTIFICATION_WEBHOOK_DURABILITY_REQUIRED` with `Retry-After: 60`. No delivery
status is projected until a durable, idempotent provider receipt is available.

```ts
interface NotificationsController {
  // Notification CRUD
  create(params: { customerId: string; type?: NotificationType; channel?: NotificationChannel; priority?: NotificationPriority; title: string; body: string; actionUrl?: string; metadata?: Record<string, unknown> }): Promise<Notification>;
  get(id: string): Promise<Notification | null>;
  update(id: string, params: { title?: string; body?: string; actionUrl?: string; metadata?: Record<string, unknown> }): Promise<Notification | null>;
  delete(id: string): Promise<boolean>;
  list(params?: { customerId?: string; type?: NotificationType; read?: boolean; priority?: NotificationPriority; take?: number; skip?: number }): Promise<Notification[]>;

  // Read tracking
  markRead(id: string): Promise<Notification | null>;
  markAllRead(customerId: string): Promise<number>;
  unreadCount(customerId: string): Promise<number>;
  getStats(): Promise<NotificationStats>;
  bulkDelete(ids: string[]): Promise<number>;

  // Preferences
  getPreferences(customerId: string): Promise<NotificationPreference>;
  updatePreferences(customerId: string, params: { orderUpdates?: boolean; promotions?: boolean; shippingAlerts?: boolean; accountAlerts?: boolean }): Promise<NotificationPreference>;
  deletePreferences(customerId: string): Promise<boolean>;
  listPreferences(params?: { take?: number; skip?: number }): Promise<NotificationPreference[]>;

  // Templates
  createTemplate(params: { slug: string; name: string; type?: NotificationType; channel?: NotificationChannel; priority?: NotificationPriority; titleTemplate: string; bodyTemplate: string; actionUrlTemplate?: string; variables?: string[] }): Promise<NotificationTemplate>;
  getTemplate(id: string): Promise<NotificationTemplate | null>;
  getTemplateBySlug(slug: string): Promise<NotificationTemplate | null>;
  updateTemplate(id: string, params: Partial<Pick<NotificationTemplate, 'name' | 'type' | 'channel' | 'priority' | 'titleTemplate' | 'bodyTemplate' | 'actionUrlTemplate' | 'variables' | 'active'>>): Promise<NotificationTemplate | null>;
  deleteTemplate(id: string): Promise<boolean>;
  listTemplates(params?: { active?: boolean; take?: number; skip?: number }): Promise<NotificationTemplate[]>;

  // Batch + template-based send
  sendFromTemplate(params: { templateId: string; customerIds: string[]; variables?: Record<string, string> }): Promise<BatchSendResult>;
  batchSend(params: { customerIds: string[]; type?: NotificationType; channel?: NotificationChannel; priority?: NotificationPriority; title: string; body: string; actionUrl?: string; metadata?: Record<string, unknown> }): Promise<BatchSendResult>;
}
```

## Types

```ts
type NotificationType = "info" | "success" | "warning" | "error" | "order" | "shipping" | "promotion";
type NotificationChannel = "in_app" | "email" | "both";
type NotificationPriority = "low" | "normal" | "high" | "urgent";

interface Notification {
  id: string;
  customerId: string;
  type: NotificationType;
  channel: NotificationChannel;
  priority: NotificationPriority;
  title: string;
  body: string;
  actionUrl?: string;
  metadata: Record<string, unknown>;
  read: boolean;
  readAt?: Date;
  createdAt: Date;
}

interface NotificationTemplate {
  id: string;
  slug: string;
  name: string;
  type: NotificationType;
  channel: NotificationChannel;
  priority: NotificationPriority;
  titleTemplate: string;    // Supports {{variable}} interpolation
  bodyTemplate: string;
  actionUrlTemplate?: string;
  variables: string[];      // Expected variable names
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface NotificationPreference {
  id: string;
  customerId: string;
  orderUpdates: boolean;
  promotions: boolean;
  shippingAlerts: boolean;
  accountAlerts: boolean;
  updatedAt: Date;
}

interface NotificationStats {
  total: number;
  unread: number;
  byType: Record<string, number>;
  byPriority: Record<string, number>;
}

interface BatchSendResult {
  sent: number;
  failed: number;
  errors: Array<{ customerId: string; error: string }>;
}
```

## Store Components

### NotificationBell

Displays a bell icon with unread count badge.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `href` | `string` | No | URL the bell links to. Defaults to `"/account/notifications"`. |

### NotificationInbox

Full notification inbox with filtering, mark-as-read, and mark-all-read.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `title` | `string` | No | Heading text. Defaults to `"Notifications"`. |
| `emptyMessage` | `string` | No | Empty state message. |

### NotificationPreferences

Toggle switches for notification categories (order updates, promotions, shipping alerts, account alerts).

No props required.

## Events

The module emits these events via `ScopedEventEmitter` (fire-and-forget):

| Event | Payload | When |
|---|---|---|
| `notifications.created` | `{ notificationId, customerId, type, priority }` | On every `create()` call |
| `notifications.read` | `{ notificationId, customerId }` | First time a notification is marked as read |
| `notifications.all_read` | `{ customerId, count }` | When `markAllRead()` processes >0 notifications |

## Notes

- Templates use `{{variable}}` syntax for interpolation. Unknown variables are preserved as-is.
- `batchSend` and `sendFromTemplate` accept up to 500 customer IDs per call.
- Inactive templates cannot be used with `sendFromTemplate`.
- Template slugs must be unique, lowercase alphanumeric with hyphens.
- Preferences default to all categories enabled; customers opt out individually.
- Stats include breakdowns by both notification type and priority level.
- `maxPerCustomer` enforcement: oldest notifications are auto-deleted after every `create()` when the limit is exceeded.
- Customers can delete their own notifications via the store endpoint (ownership verified, returns 404 for non-owner).
- Admins can view, update, and reset customer notification preferences.
