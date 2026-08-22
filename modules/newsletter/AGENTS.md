# Newsletter Module

Manages an email subscriber list. Does NOT send emails — that is left to external integrations. Simply manages the subscriber database.

**Parent:** repository root [`AGENTS.md`](../../AGENTS.md) owns change protocol, Module integrity (_frozen_ lock), TypeScript, security, product language, testing, and commit gates. This guide owns local mechanics only.

## Change protocol

1. **Route.** Read the parent guide, `../../../prd/contexts/store-runtime/module-system.md` when storage or cross-Module contracts change, and this file.
2. **Implement** within the Module source shape and patterns below.
3. **Verify.** From the repository root after any Module source change: `bun run generate:modules`, then prove `bun run generate:modules -- --frozen`. Run this Module's focused tests.
   - Done when the frozen check is _green_ and touched Module tests pass.

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
