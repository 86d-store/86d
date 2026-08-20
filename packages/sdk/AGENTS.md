# @86d-app/sdk

SDK package for 86d store configuration and API integration.

## Purpose

Resolves store configuration from either:
- **86d Control Plane** — when the managed workload trio is present (`86D_STORE_ID`, `86D_API_URL`, `86D_WORKLOAD_CREDENTIAL`)
- **Template config.json** — when `templatePath` is provided and no managed workload is configured

## Structure

```
packages/sdk/
  src/
    index.ts              Main exports
    get-store-config.ts   Resolution logic (API vs template)
    fetch-from-api.ts     GET /v1/stores/:id from 86d API
    load-from-template.ts readFileSync from template path
    types.ts              Config, IconLogoVariant, ThemeVariables
```

## Key exports

- `getStoreConfig(options?)` — async; primary entry point
- `loadFromTemplate(templatePath)` — sync; load from local JSON
- `fetchFromApi(storeId, apiBaseUrl, fetcher?)` — async; fetch from API. Managed `getStoreConfig` authenticates with a workload token.
- `Config`, `RemoteStoreConfig`, `DEFAULT_CONFIG`, `GetStoreConfigOptions`

Managed fetches request
`application/vnd.86d.store-runtime-config.v2+json`. The v2 DTO carries the
Store-scoped entitlement and the Control Plane's versioned commerce-availability
decision. A strict legacy v1 DTO remains readable during rollout; unknown fields
fail closed in both versions.

## Environment variables

Managed identity is `86D_STORE_ID`, `86D_API_URL`, and `86D_WORKLOAD_CREDENTIAL`. Standalone `STORE_ID` remains for local data isolation. See `packages/env/src/index.ts`.

## Usage

```ts
import { getStoreConfig } from "@86d-app/sdk";

const config = await getStoreConfig({
  templatePath: "/path/to/templates/brisa/config.json",
});
```

Remote Control Plane responses use a strict `RemoteStoreConfig` DTO and fail
closed on unknown fields. Store-owned Module options and notification settings
exist only in local template `Config`; do not add them to the remote DTO.

## Dependencies

- `zod` — response validation
- No `db` or `env` — standalone; reads `process.env` directly
