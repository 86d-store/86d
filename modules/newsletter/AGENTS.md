# newsletter module

Manages an email subscriber list. Does NOT send emails — that is left to external integrations. Simply manages the subscriber database.

## Schema

- `subscriber` — stores a single email subscriber with status, source, tags (JSON array), and metadata (JSON object).

## Service

`NewsletterController` exposes:

- `subscribe` — add a new subscriber or reactivate an existing one
- `unsubscribe` — set status to `unsubscribed`
- `resubscribe` — set status back to `active`
- `getSubscriber` — fetch by id
- `getSubscriberByEmail` — fetch by email
- `updateSubscriber` — update name, tags, metadata, or status
- `deleteSubscriber` — hard delete
- `listSubscribers` — list with optional status/tag filters + pagination

## Key Logic

- `subscribe`: idempotent — returns existing subscriber if already active; reactivates if unsubscribed or bounced.
- `unsubscribe`: sets `unsubscribedAt` timestamp.
- `resubscribe`: clears `unsubscribedAt`.
- `listSubscribers`: tag filter checks `subscriber.tags.includes(tag)`.

## Endpoints

### Store
- `POST /newsletter/subscribe` — subscribe (email, firstName?, lastName?, source?, tags?)
- `POST /newsletter/unsubscribe` — unsubscribe (email)

### Admin
- `GET /admin/newsletter` — list subscribers (status?, tag?, page?, limit?)
- `DELETE /admin/newsletter/:id/delete` — delete subscriber

## Tests

30 tests in `tests/service-impl.test.ts` covering all controller methods.

## Events

| Event | Trigger | Payload |
|---|---|---|
| `newsletter.subscribed` | New subscriber added or reactivated | `subscriberId`, `email`, `source` |
| `newsletter.unsubscribed` | Subscriber opts out | `subscriberId`, `email` |
| `newsletter.campaign.sent` | Campaign sent to subscriber list | `campaignId`, `subject`, `recipientCount` |
