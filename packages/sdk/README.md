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

# @86d-store/sdk

SDK for 86d store configuration. Resolves store config from the 86d hosted API or local template files.

## Installation

```bash
bun add @86d-store/sdk
```

## Usage

### Resolve store config

```ts
import { getStoreConfig } from "@86d-store/sdk/get-store-config";

// Managed deployments use 86D_STORE_ID, 86D_API_URL, and the opaque
// 86D_WORKLOAD_CREDENTIAL. Standalone deployments load the local template.
const config = await getStoreConfig({
  templatePath: "/path/to/templates/brisa/config.json",
});

console.log(config.name, config.modules);
```

### Load from template only

```ts
import { loadFromTemplate } from "@86d-store/sdk/load-from-template";

const config = loadFromTemplate("./templates/brisa/config.json");
```

### Fetch from API directly

```ts
import { fetchFromApi } from "@86d-store/sdk/fetch-from-api";
import {
  createWorkloadTokenClient,
  readManagedWorkloadConfig,
} from "@86d-store/sdk/workload-token-client";

const managed = readManagedWorkloadConfig();
if (!managed) throw new Error("Managed workload identity is required");
const client = createWorkloadTokenClient({ config: managed });
const resource = {
  audience: "https://86d.app/api/store-runtime",
  scopes: ["runtime.config:read"],
};

const config = await fetchFromApi(
  managed.storeId,
  managed.apiBaseUrl,
  (url, init) => client.request(resource, url, init),
);
```

### Report Managed Runtime Diagnostics

Managed Runtime Diagnostics is disabled unless `86D_TELEMETRY` is exactly
`managed-runtime-diagnostics-v1` and the complete managed workload identity is
present. Disabled and standalone clients make no Control Plane network call.

```ts
import { createManagedRuntimeDiagnosticsClient } from "@86d-store/sdk/managed-runtime-diagnostics";

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
} from "@86d-store/sdk/types";
import { DEFAULT_CONFIG } from "@86d-store/sdk/types";
```

## API endpoint

When the managed workload trio is present, the SDK calls:

```
POST {apiRoot}/v1/stores/get-by-id
Accept: application/vnd.86d.store-runtime-config.v2+json
Content-Type: application/json

{ "id": "store-uuid-here" }
```

`apiRoot` appends `/api` to the configured base URL when it is absent. The
workload client obtains a short-lived `runtime.config:read` token and
authenticates the request. HTTP 401 with a Bearer `invalid_token` challenge
refreshes the token and retries the same POST once. HTTP 403 does not trigger
another exchange. A static store API key is not accepted.
The response is validated as a strict, fail-closed `RemoteStoreConfig` and
contains theme and template identity, store name/assets, installed module names,
the store entitlement, and the versioned commerce-availability decision. The
SDK retains strict legacy v1 billing responses and historical responses without
template identity. Unknown fields are rejected. Module settings,
notification settings, provider secrets, and webhook settings never cross this
endpoint; standalone template `Config` retains those Store-owned settings.

The SDK uses only the shared POST operation. Deployments using the former GET
path require a coordinated server and runtime update; merging SDK source does
not update a deployed runtime. Managed configuration failures never fall back
to a standalone template.
