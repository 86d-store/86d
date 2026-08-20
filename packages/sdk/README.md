# @86d-app/sdk

SDK for 86d store configuration. Resolves store config from the 86d hosted API or local template files.

## Installation

```bash
bun add @86d-app/sdk
```

## Usage

### Resolve store config

```ts
import { getStoreConfig } from "@86d-app/sdk";

// Managed deployments use 86D_STORE_ID, 86D_API_URL, and the opaque
// 86D_WORKLOAD_CREDENTIAL. Standalone deployments load the local template.
const config = await getStoreConfig({
  templatePath: "/path/to/templates/brisa/config.json",
  fallbackToTemplateOnError: true,
});

console.log(config.name, config.modules);
```

### Load from template only

```ts
import { loadFromTemplate } from "@86d-app/sdk";

const config = loadFromTemplate("./templates/brisa/config.json");
```

### Fetch from API directly

```ts
import { fetchFromApi } from "@86d-app/sdk";

const config = await fetchFromApi(
  "store-uuid-here",
  "https://api.86d.app",
  "optional-api-key"
);
```

### Report Managed Runtime Diagnostics

Managed Runtime Diagnostics is disabled unless `86D_TELEMETRY` is exactly
`managed-runtime-diagnostics-v1` and the complete managed workload identity is
present. Disabled and standalone clients make no Control Plane network call.

```ts
import { createManagedRuntimeDiagnosticsClient } from "@86d-app/sdk";

const diagnostics = createManagedRuntimeDiagnosticsClient();
await diagnostics.report({
  schemaVersion: 1,
  reportId: crypto.randomUUID(), // reuse this ID when retrying the same report
  observedAt: new Date().toISOString(),
  health: "healthy",
  runtimeVersion: "0.0.4",
  checks: [
    { component: "runtime", status: "ok" },
    { component: "database", status: "ok" },
  ],
  errors: [],
});
```

The client posts to `POST /api/v1/workloads/diagnostics` with the
`runtime.telemetry:write` workload scope. The strict v1 body has no Store
selector or free-form fields; the Control Plane derives Store scope from the
short-lived workload token.

## Configuration

| Option | Description | Default |
|--------|-------------|---------|
| `storeId` | Legacy migration-only Store UUID | `process.env.STORE_ID` |
| `apiBaseUrl` | 86d API base URL | `process.env.86D_API_URL` or `https://api.86d.app` |
| `apiKey` | Legacy migration-only API key | `process.env.86D_API_KEY` |
| `templatePath` | Path to config.json | Required when no STORE_ID |
| `fallbackToTemplateOnError` | Use template if API fails | `false` |

## Types

```ts
import type {
  Config,
  IconLogoVariant,
  RemoteStoreConfig,
  ThemeVariables,
} from "@86d-app/sdk";
import { DEFAULT_CONFIG } from "@86d-app/sdk";
```

## API endpoint

When `STORE_ID` is set, the SDK calls:

```
GET {apiBaseUrl}/v1/stores/{storeId}
Authorization: Bearer {apiKey}  # if apiKey provided
```

Managed configuration uses a short-lived `runtime.config:read` workload token.
The response is validated as a strict, fail-closed `RemoteStoreConfig` and
contains only theme identity, Store name/assets, installed Module names, and
managed billing status. Unknown fields are rejected. Module settings,
notification settings, provider secrets, and webhook settings never cross this
endpoint; standalone template `Config` retains those Store-owned settings.
