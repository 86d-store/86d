# SDK

Store configuration and API integration for managed and standalone Store Runtimes.

**Parent:** repository root [`AGENTS.md`](../../AGENTS.md) owns change protocol, Module integrity (_frozen_ lock), TypeScript, security, product language, testing, and commit gates. This guide owns local mechanics only.

## Change protocol

1. **Route.** Read the parent guide and this file. Deployment identity (managed workload trio vs standalone `STORE_ID`) is in the parent.
2. **Implement** using the local patterns below. Remote DTOs fail closed on unknown fields.
3. **Verify.** Focused package tests while iterating. Full pre-commit gates live in the parent guide. After `modules/` changes, prove `bun run generate:modules -- --frozen` from repo root.
   - Done when every required parent gate for the _slice_ is _green_.

## Purpose

Resolves store configuration from either:

- **Managed Control Plane path** — when the managed workload trio is present (`86D_STORE_ID`, `86D_API_URL`, `86D_WORKLOAD_CREDENTIAL`)
- **Template `config.json`** — when `templatePath` is provided and no managed workload is configured

## Structure

```
src/
  get-store-config.ts   Resolution logic (API vs template)
  fetch-from-api.ts     POST /api/v1/stores/get-by-id
  load-from-template.ts readFileSync from template path
  types.ts              Config, IconLogoVariant, ThemeVariables
```

## Key exports

- `getStoreConfig(options?)` — async; primary entry point
- `loadFromTemplate(templatePath)` — sync; load from local JSON
- `fetchFromApi(storeId, apiBaseUrl, fetcher?)` — async; managed `getStoreConfig` authenticates with a workload token
- `Config`, `RemoteStoreConfig`, `DEFAULT_CONFIG`, `GetStoreConfigOptions`

Managed fetches post `{ id: storeId }` to `/api/v1/stores/get-by-id` and request `application/vnd.86d.store-runtime-config.v2+json`. The v2 DTO carries template identity, the Store-scoped entitlement, and the Control Plane's versioned commerce-availability decision. Historical responses may omit template identity; strict v1 responses remain readable. Unknown fields fail closed in both versions.

Config changes also update `src/__tests__/fixtures/store-runtime-config.json`. These portable producer fixtures cover both versions, lifecycle transitions, overdue deadlines, renewal grace, and invalid entitlements. Keep them identical to the Control Plane contract fixtures when coordinating a wire change. The consumer tests prove acceptance and projection; the producer owns the authoritative availability decision.

Workload config requests retry once only after HTTP 401 with `WWW-Authenticate: Bearer error="invalid_token"`. Preserve the POST body and Accept header when replacing the token. Authorization denials and unavailable configuration fail closed without switching to a standalone template.

## Environment

Managed identity: `86D_STORE_ID`, `86D_API_URL`, `86D_WORKLOAD_CREDENTIAL`. Standalone `STORE_ID` remains for local data isolation. Schema details: `packages/env`.

## Usage

```ts
import { getStoreConfig } from "@86d-store/sdk/get-store-config";

const config = await getStoreConfig({
  templatePath: "/path/to/templates/brisa/config.json",
});
```

Remote Control Plane responses use a strict `RemoteStoreConfig` DTO and fail closed on unknown fields. Store-owned Module options and notification settings exist only in local template `Config`; do not add them to the remote DTO.

## Dependencies

- `zod` — response validation
- `env/process-env` — environment access; standalone configuration needs no database or Control Plane client
