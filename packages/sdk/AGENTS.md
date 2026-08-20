# @86d-app/sdk

SDK package for 86d store configuration and API integration.

## Purpose

Resolves store configuration from either:
- **86d hosted API** — when `STORE_ID` is set (valid UUID)
- **Template config.json** — when `STORE_ID` is absent or invalid

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
- `fetchFromApi(storeId, apiBaseUrl, apiKey?)` — async; fetch from API
- `Config`, `RemoteStoreConfig`, `DEFAULT_CONFIG`, `GetStoreConfigOptions`

Managed fetches request
`application/vnd.86d.store-runtime-config.v2+json`. The v2 DTO carries the
Store-scoped entitlement and the Control Plane's versioned commerce-availability
decision. A strict legacy v1 DTO remains readable during rollout; unknown fields
fail closed in both versions.

## Environment variables

- `STORE_ID` — optional UUID; when set and valid, fetches from API
- `86D_API_URL` — optional; default `https://api.86d.app`
- `86D_API_KEY` — optional; Bearer token for API auth

## Usage

```ts
import { getStoreConfig } from "@86d-app/sdk";

const config = await getStoreConfig({
  templatePath: "/path/to/templates/brisa/config.json",
  fallbackToTemplateOnError: true,
});
```

Remote Control Plane responses use a strict `RemoteStoreConfig` DTO and fail
closed on unknown fields. Store-owned Module options and notification settings
exist only in local template `Config`; do not add them to the remote DTO.

## Dependencies

- `zod` — response validation
- No `db` or `env` — standalone; reads `process.env` directly
