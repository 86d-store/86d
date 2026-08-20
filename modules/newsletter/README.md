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

# Newsletter Module

📚 **Documentation:** [86d.app/docs/modules/newsletter](https://86d.app/docs/modules/newsletter)

Newsletter subscription management for the 86d commerce platform. Handles subscriber lifecycle (subscribe, unsubscribe, resubscribe) with idempotent operations and tagging support.

![version](https://img.shields.io/badge/version-0.0.1-blue) ![license](https://img.shields.io/badge/license-MIT-green)

## Installation

```sh
npm install @86d-app/newsletter
```

## Usage

```ts
import newsletter from "@86d-app/newsletter";
import { createModuleClient } from "@86d-app/core";

const client = createModuleClient([
  newsletter({
    allowResubscribe: "true",  // default: allow resubscription
  }),
]);
```

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `allowResubscribe` | `"true" \| "false"` | `"true"` | Allow previously unsubscribed users to resubscribe |

## Subscriber Lifecycle

```
subscribe()      → active
unsubscribe()    → unsubscribed  (sets unsubscribedAt timestamp)
resubscribe()    → active        (clears unsubscribedAt, preserves original subscribedAt)
```

`subscribe()` is **idempotent**: calling it for an already-active email returns the existing subscriber unchanged. For an unsubscribed or bounced subscriber, it reactivates them while preserving the original `subscribedAt` date.

## Store Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/newsletter/subscribe` | Subscribe an email address |
| `POST` | `/newsletter/unsubscribe` | Unsubscribe an email address |

**`POST /newsletter/subscribe` body:**
```json
{
  "email": "jane@example.com",
  "firstName": "Jane",
  "lastName": "Doe",
  "source": "footer-form",
  "tags": ["launch-announcement"]
}
```

**`POST /newsletter/unsubscribe` body:**
```json
{
  "email": "jane@example.com"
}
```

## Admin Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/admin/newsletter` | List subscribers (filter: `status`, `tag`, paginate: `page`, `limit`) |
| `DELETE` | `/admin/newsletter/:id/delete` | Delete a subscriber permanently |

**Query parameters for `GET /admin/newsletter`:**

| Param | Type | Default | Description |
|---|---|---|---|
| `status` | `"active" \| "unsubscribed" \| "bounced"` | — | Filter by subscriber status |
| `tag` | `string` | — | Filter by tag |
| `page` | `number` | `1` | Page number (1-indexed) |
| `limit` | `number` | `50` | Results per page (max 100) |

## Controller API

```ts
controller.subscribe(params: {
  email: string;
  firstName?: string;
  lastName?: string;
  source?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}): Promise<Subscriber>

controller.unsubscribe(email: string): Promise<Subscriber | null>

controller.resubscribe(email: string): Promise<Subscriber | null>

controller.getSubscriber(id: string): Promise<Subscriber | null>

controller.getSubscriberByEmail(email: string): Promise<Subscriber | null>

controller.updateSubscriber(id: string, params: {
  firstName?: string;
  lastName?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
  status?: SubscriberStatus;
}): Promise<Subscriber | null>

controller.deleteSubscriber(id: string): Promise<boolean>

controller.listSubscribers(params?: {
  status?: SubscriberStatus;
  tag?: string;
  take?: number;
  skip?: number;
}): Promise<Subscriber[]>
```

## Example: Subscription Flow

```ts
// Customer subscribes via storefront form
const subscriber = await controller.subscribe({
  email: "jane@example.com",
  firstName: "Jane",
  source: "footer-form",
  tags: ["weekly-digest"],
});
// subscriber.status === "active"

// Customer unsubscribes via email link
await controller.unsubscribe("jane@example.com");
// subscriber.status === "unsubscribed"

// Customer resubscribes later
await controller.resubscribe("jane@example.com");
// subscriber.status === "active", original subscribedAt preserved

// Admin lists active subscribers
const active = await controller.listSubscribers({ status: "active" });

// Admin filters by tag
const digest = await controller.listSubscribers({ tag: "weekly-digest" });
```

## Types

```ts
type SubscriberStatus = "active" | "unsubscribed" | "bounced";

interface Subscriber {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  status: SubscriberStatus;
  source?: string;
  tags: string[];
  metadata: Record<string, unknown>;
  subscribedAt: Date;
  unsubscribedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

## Store Components

### NewsletterForm

Email subscription form with optional name fields.

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `showName` | `boolean` | `false` | Show first/last name fields |
| `source` | `string` | — | Attribution source (e.g. `"footer-form"`) |
| `title` | `string` | `"Subscribe to our newsletter"` | Form heading |
| `description` | `string` | `"Get the latest updates..."` | Form description |
| `compact` | `boolean` | `false` | Compact inline layout |

#### Usage in MDX

```mdx
<NewsletterForm />

<NewsletterForm
  showName={true}
  source="footer"
  title="Stay in the loop"
  compact={true}
/>
```

### NewsletterInline

Inline newsletter signup for use in blog posts or product pages.

#### Props

Same as `NewsletterForm`. Use `compact={true}` for inline placement.

#### Usage in MDX

```mdx
<NewsletterInline compact={true} source="product-page" />
```
