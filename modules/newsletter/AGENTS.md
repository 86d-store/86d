# Newsletter Module

Manages an email subscriber list. Does NOT send emails — that is left to external integrations. Simply manages the subscriber database.

**Scope:** This guide owns Module-specific mechanics. In the 86d.store source checkout, read the repository root [`AGENTS.md`](../../AGENTS.md) for shared rules and gates. In another project, follow that project's instructions and the installed `@86d-store/core` contracts.

## Change protocol

1. **Route.** Read this guide and the Module's [`README.md`](./README.md). In the 86d.store source checkout, storage or cross-Module changes also follow the root [Module contracts](../../AGENTS.md#module-contracts) routes.
2. **Implement** within the Module source shape and patterns below.
3. **Verify.** In the 86d.store source checkout, run `bun run generate:modules` after a Module change, then `bun run generate:modules -- --frozen` and the parent gates. In another project, use that project's checks. Run the Module's focused tests when available.
   - Done when the current project's required checks pass; source-checkout work also requires a passing frozen registry check.

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
