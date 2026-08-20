

# @86d-app/automations

📚 **Documentation:** [86d.app/docs/modules/automations](https://86d.app/docs/modules/automations)

Event-driven workflow automation for the 86d commerce platform. Create rules that trigger on platform events, evaluate conditions against the event payload, and execute configurable actions like sending notifications, webhooks, or updating records.

## Installation

The module is included in the 86d monorepo. Enable it in your store's template `config.json`:

```json
{
  "modules": ["automations"]
}
```

## Usage

```ts
import automations from "@86d-app/automations";

// Register the module
const mod = automations({
  maxExecutionHistory: 1000
});
```

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `maxExecutionHistory` | `number` | `0` | Max execution records per automation. `0` disables auto-purge. |

## Admin Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/admin/automations` | List automations (filter by `status`, `triggerEvent`) |
| `GET` | `/admin/automations/stats` | Aggregate stats (counts, top automations) |
| `GET` | `/admin/automations/:id` | Get automation detail |
| `POST` | `/admin/automations/create` | Create automation |
| `POST` | `/admin/automations/:id/update` | Update automation |
| `POST` | `/admin/automations/:id/delete` | Delete automation + executions |
| `POST` | `/admin/automations/:id/activate` | Set status to active |
| `POST` | `/admin/automations/:id/pause` | Set status to paused |
| `POST` | `/admin/automations/:id/duplicate` | Clone as draft |
| `POST` | `/admin/automations/:id/execute` | Manually trigger with payload |
| `GET` | `/admin/automations/executions` | List executions (filter by `automationId`, `status`) |
| `GET` | `/admin/automations/executions/:id` | Get execution detail |
| `POST` | `/admin/automations/executions/purge` | Delete old executions |

## Store Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/automations/trigger` | Trigger automation events from the storefront. Only allowlisted `storefront.*` event types are accepted (e.g. `storefront.form_submitted`, `storefront.page_viewed`, `storefront.cart_updated`). |
| `POST` | `/automations/webhooks` | Receive events from external services (Zapier, custom integrations). Any event type is accepted. Authenticated via `x-webhook-secret` header when `webhookSecret` is configured. |

## Controller API

```ts
interface AutomationsController {
  create(params: CreateAutomationParams): Promise<Automation>;
  getById(id: string): Promise<Automation | null>;
  list(params?: AutomationListParams): Promise<{ automations: Automation[]; total: number }>;
  update(id: string, params: UpdateAutomationParams): Promise<Automation>;
  delete(id: string): Promise<void>;
  activate(id: string): Promise<Automation>;
  pause(id: string): Promise<Automation>;
  duplicate(id: string): Promise<Automation>;
  execute(id: string, payload: Record<string, unknown>): Promise<AutomationExecution>;
  evaluateEvent(eventType: string, payload: Record<string, unknown>): Promise<AutomationExecution[]>;
  getExecution(id: string): Promise<AutomationExecution | null>;
  listExecutions(params?: ExecutionListParams): Promise<{ executions: AutomationExecution[]; total: number }>;
  getStats(): Promise<AutomationStats>;
  purgeExecutions(olderThan: Date): Promise<number>;
}
```

## Concepts

### Trigger Events

Each automation listens for a specific event type string (e.g. `order.placed`, `inventory.low_stock`, `customer.created`). When `evaluateEvent()` is called with that event type, all active automations matching it run in priority order.

### Conditions

Conditions filter which events actually trigger actions. All conditions must pass (AND logic). An automation with no conditions always matches.

| Operator | Description | Value type |
|----------|-------------|------------|
| `equals` | Exact match | string, number, boolean |
| `not_equals` | Not equal | string, number, boolean |
| `contains` | Substring match | string |
| `not_contains` | No substring match | string |
| `greater_than` | Numeric comparison | number |
| `less_than` | Numeric comparison | number |
| `exists` | Field is present and non-null | (none) |
| `not_exists` | Field is missing or null | (none) |

### Actions

Each automation has one or more actions executed in order:

| Action Type | Config | Description |
|-------------|--------|-------------|
| `send_notification` | `{ title, message }` | In-app notification |
| `send_email` | `{ to, subject }` | Email dispatch |
| `webhook` | `{ url }` | HTTP webhook call |
| `update_field` | `{ entity, field, value }` | Update a record field |
| `create_record` | `{ entity }` | Create a new record |
| `log` | `{}` | Log the event |

### Execution Status

| Status | Meaning |
|--------|---------|
| `completed` | All actions succeeded |
| `failed` | One or more actions failed |
| `skipped` | Conditions not met |
| `pending` | Queued for execution |
| `running` | Currently executing |

## Types

```ts
type AutomationStatus = "active" | "paused" | "draft";
type ExecutionStatus = "pending" | "running" | "completed" | "failed" | "skipped";
type ConditionOperator = "equals" | "not_equals" | "contains" | "not_contains" | "greater_than" | "less_than" | "exists" | "not_exists";
type ActionType = "send_notification" | "send_email" | "update_field" | "create_record" | "webhook" | "log";
```

## Notes

- Two store-facing endpoints allow the storefront and external integrations to trigger automations.
- `evaluateEvent()` is the primary integration point for the platform event system.
- Duplicating an automation resets its status to `draft` and run count to `0`.
- Deleting an automation cascades to all its execution records.
- Action execution currently validates configuration and produces results; actual side-effects (sending emails, calling webhooks) are dispatched through the platform's notification and email modules.
