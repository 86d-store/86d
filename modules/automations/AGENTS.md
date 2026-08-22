# Automations Module

Event-driven workflow automation. Rules trigger on platform events, evaluate conditions, and execute configurable actions.

**Parent:** repository root [`AGENTS.md`](../../AGENTS.md) owns change protocol, Module integrity (_frozen_ lock), TypeScript, security, product language, testing, and commit gates. This guide owns local mechanics only.

## Change protocol

1. **Route.** Read the parent guide, `../../../prd/contexts/store-runtime/module-system.md` when storage or cross-Module contracts change, and this file.
2. **Implement** within the Module source shape and patterns below.
3. **Verify.** From the repository root after any Module source change: `bun run generate:modules`, then prove `bun run generate:modules -- --frozen`. Run this Module's focused tests.
   - Done when the frozen check is _green_ and touched Module tests pass.

## Structure

```
src/
  index.ts              Module factory + type exports
  schema.ts             ModuleSchema (automation, automationExecution)
  service.ts            Controller interface + all type definitions
  service-impl.ts       Controller implementation (condition eval, action dispatch)
  mdx.d.ts              MDX module declaration
  store/endpoints/
    index.ts            Store endpoint factory (createStoreEndpoints)
    trigger-event.ts    POST /automations/trigger (storefront event allowlist)
    webhook.ts          POST /automations/webhooks (external webhook reception)
  admin/endpoints/
    index.ts            Endpoint registry (13 admin endpoints)
    list-automations.ts GET  /admin/automations
    get-automation.ts   GET  /admin/automations/:id
    create-automation.ts POST /admin/automations/create
    update-automation.ts POST /admin/automations/:id/update
    delete-automation.ts POST /admin/automations/:id/delete
    activate-automation.ts POST /admin/automations/:id/activate
    pause-automation.ts POST /admin/automations/:id/pause
    duplicate-automation.ts POST /admin/automations/:id/duplicate
    execute-automation.ts POST /admin/automations/:id/execute
    list-executions.ts  GET  /admin/automations/executions
    get-execution.ts    GET  /admin/automations/executions/:id
    stats.ts            GET  /admin/automations/stats
    purge-executions.ts POST /admin/automations/executions/purge
  admin/components/
    index.ts            Component exports
    automation-list.tsx  List view with status filters + pagination
    automation-list.mdx  List layout template
    automation-detail.tsx Detail view with actions/conditions/executions
    automation-detail.mdx Detail layout template
  __tests__/
    service-impl.test.ts 53 tests covering all controller methods
```

## Data models

**automation** — Rule definition

- `id`, `name`, `description`, `status` (active|paused|draft)
- `triggerEvent` — event type string (e.g. "order.placed")
- `conditions` — JSON array of `{field, operator, value}`
- `actions` — JSON array of `{type, config}`
- `priority` — higher = runs first when multiple match
- `runCount`, `lastRunAt`, `createdAt`, `updatedAt`

**automationExecution** — Run history

- `id`, `automationId`, `triggerEvent`, `triggerPayload`
- `status` (pending|running|completed|failed|skipped)
- `results` — JSON array of action results
- `error`, `startedAt`, `completedAt`

## Condition operators

`equals`, `not_equals`, `contains`, `not_contains`, `greater_than`, `less_than`, `exists`, `not_exists`

All conditions are ANDed. Empty conditions = always match.

## Action types

| Type | Required config |
| --- | --- |
| `send_notification` | `title`, `message` |
| `send_email` | `to`, `subject` |
| `webhook` | `url` |
| `update_field` | `entity`, `field` |
| `create_record` | `entity` |
| `log` | (none) |

## Options

```ts
interface AutomationsOptions {
  maxExecutionHistory?: number; // 0 = no auto-purge (default)
}
```

## Patterns

- Controller created via `init()` with `createAutomationsController(ctx.data)`
- `evaluateEvent(eventType, payload)` — finds all active automations matching the event, runs them in priority order
- Conditions evaluated in-memory against the trigger payload
- Actions are validated and produce `AutomationActionResult` (actual side-effects dispatched through events in production)
- Cascade delete: deleting an automation removes its executions
- Two store endpoints: `/automations/trigger` (public, allowlisted storefront events only) and `/automations/webhooks` (external integrations, authenticated via `x-webhook-secret` header)
- `createStoreEndpoints(opts?)` factory accepts optional `webhookSecret` for webhook authentication
- Action execution is synchronous validation; real side-effects (email, webhook) require integration with the notification/email modules
- `evaluateEvent` is the main entry point for the event system to invoke automations
- `duplicate()` resets status to draft and runCount to 0
