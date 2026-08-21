<p align="center">
  <a href="https://86d.app">
    <img src="https://86d.app/icon" height="96" alt="86d" />
  </a>
</p>

<p align="center">
  The Modern Foundation for Commerce
</p>

<p align="center">
  <a href="https://x.com/86d_app"><strong>X</strong></a> ·
  <a href="https://www.linkedin.com/company/86d"><strong>LinkedIn</strong></a>
</p>
<br/>

> [!WARNING]
> This project is under active development and is not ready for production use. Please proceed with caution. Use at your own risk. 

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
| `templatePath` | Path to template config.json | Required when no managed workload trio is present |

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

When the managed workload trio is present, the SDK calls:

```
GET {apiBaseUrl}/v1/stores/{storeId}
```

The workload client obtains a short-lived `runtime.config:read` token and
authenticates the request. A static Store API key is not accepted.
The response is validated as a strict, fail-closed `RemoteStoreConfig` and
contains only theme identity, Store name/assets, installed Module names, and
managed billing status. Unknown fields are rejected. Module settings,
notification settings, provider secrets, and webhook settings never cross this
endpoint; standalone template `Config` retains those Store-owned settings.
