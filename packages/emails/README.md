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

# Emails

Transactional email package for the 86d platform. Includes a configured [Resend](https://resend.com/) client and 16 React-based email templates for commerce workflows.

## Installation

```sh
npm install emails
```

### Peer Dependencies

- `react` (>=18)

## Usage

### Send an email

```ts
import resend from "emails";
import WelcomeEmail from "emails/welcome";

await resend.emails.send({
  from: "store@example.com",
  to: "customer@example.com",
  subject: "Welcome!",
  react: WelcomeEmail({ storeName: "My Store" }),
});
```

### Use a template directly

```ts
import OrderConfirmation from "emails/order-confirmation";

const element = OrderConfirmation({
  storeName: "My Store",
  orderNumber: "ORD-001",
  items: [{ name: "Widget", quantity: 2, price: 1999 }],
  total: 3998,
});
```

## Configuration

| Environment Variable | Required | Description |
|---|---|---|
| `RESEND_API_KEY` | Yes | Resend API key for sending emails |

## Templates

| Import Path | Description |
|---|---|
| `emails/welcome` | New account welcome |
| `emails/order-confirmation` | Order placed confirmation |
| `emails/order-completed` | Order fulfilled/completed |
| `emails/order-cancelled` | Order cancellation notice |
| `emails/shipping-notification` | Shipment dispatched |
| `emails/delivery-confirmation` | Package delivered |
| `emails/payment-failed` | Payment failure alert |
| `emails/refund-processed` | Refund issued |
| `emails/return-approved` | Return request approved |
| `emails/review-request` | Post-purchase review prompt |
| `emails/contact` | Contact form submission |
| `emails/low-stock-alert` | Admin low-stock notification |
| `emails/back-in-stock` | Customer back-in-stock alert |
| `emails/subscription-complete` | Subscription activated |
| `emails/subscription-cancel` | Subscription cancelled |
| `emails/subscription-update` | Subscription updated |

## API Reference

### Default Export — Resend Client

```ts
import resend from "emails";
```

Pre-configured Resend instance. Use `resend.emails.send()` to deliver emails.

### Template Components

Each template is a default-exported React component. Common props:

| Prop | Type | Description |
|---|---|---|
| `storeName` | `string \| undefined` | Store name shown in header and footer |

Additional props vary by template (order details, tracking info, etc.).

### Style Utilities

The internal `styles.ts` module provides:

- `formatCurrency(amount, currency?)` — formats cents to currency string (default USD)
- `formatDate(date)` — formats date to human-readable string

## Notes

- All templates use inline CSS styles for maximum email client compatibility.
- The `BaseEmail` wrapper adds a consistent header, footer, and preview text to every template.
- Prices are expected in **cents** — `formatCurrency(1999)` renders as `$19.99`.
