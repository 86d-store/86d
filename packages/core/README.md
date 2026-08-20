<p align="center">
  <a href="https://86d.app">
    <img src="https://86d.app/logo" height="96" alt="86d" />
  </a>
</p>

<p align="center">
  Dynamic Commerce
</p>

<p align="center">
  <a href="https://x.com/86d_app"><strong>X</strong></a> ·
  <a href="https://www.linkedin.com/company/86d"><strong>LinkedIn</strong></a>
</p>
<br/>

> [!WARNING]
> This project is under active development and is not ready for production use. Please proceed with caution. Use at your own risk.

# Core

Core types and utilities for building modules in the 86d module system. This package provides everything module authors need to create publishable, type-safe modules.

## Installation

```bash
npm install @86d-app/core
# or
bun add @86d-app/core
```

## Features

- **Type-safe module definition** - Full TypeScript support for modules, endpoints, and capabilities
- **Endpoint utilities** - Re-exports from `better-call` and `zod` for defining HTTP endpoints
- **Client API** - Auto-generated React Query hooks for consuming module endpoints
- **Capability kernel** - Versioned, schema-validated decisions across isolated modules
- **Owner-scoped resources** - A module receives only its own data, controllers, and options

## Creating a Module

A module is a self-contained unit with endpoints, owner-local controllers, and optionally a database schema. Immediate decisions owned by another module cross a typed capability boundary.

```typescript
import {
  acceptCapability,
  createEndpoint,
  createStoreEndpoint,
  productResolveCapability,
  z,
  type Module,
  type ModuleContext,
} from "@86d-app/core";

// Create endpoints
const getItems = createEndpoint(
  "/items",
  { method: "GET" },
  async (ctx) => {
    const context = ctx.context as ModuleContext;
    return { items: [] };
  }
);

const createItem = createEndpoint(
  "/items",
  {
    method: "POST",
    body: z.object({
      name: z.string(),
      price: z.number().positive(),
    }),
  },
  async (ctx) => {
    const { body } = ctx;
    const context = ctx.context as ModuleContext;
    // Create item logic...
    return { id: "123", ...body };
  }
);

const getProductPreview = createStoreEndpoint(
  "/preview/:productId",
  {
    method: "GET",
    params: z.object({ productId: z.string().min(1) }),
  },
  async (ctx) => {
    const result = await ctx.context.capabilities.invoke(
      productResolveCapability,
      { productId: ctx.params.productId },
    );

    if (!result.ok) {
      return { error: "Product decision unavailable", status: 503 };
    }

    return { product: result.decision.product };
  },
);

// Export module factory
export default function myModule(): Module {
  return {
    id: "my-module",
    version: "1.0.0",
    capabilities: {
      accepts: [acceptCapability(productResolveCapability)],
    },
    endpoints: {
      store: {
        "/items": createItem,
        "/items/list": getItems,
        "/preview/:productId": getProductPreview,
      },
      admin: {},
    },
  };
}
```

## Inter-module Capabilities

Capability definitions are pure, versioned schemas shared through `@86d-app/core`. The owner provides the decision and each consumer explicitly accepts the exact contract:

```typescript
// In the owner Module
capabilities: {
  provides: [provideCapability(productResolveCapability, resolveProduct)],
}

// In a consumer Module
capabilities: {
  accepts: [acceptCapability(productResolveCapability)],
}
```

The runtime will:

- Resolve required capabilities before any adapter or module initialization effects
- Reject missing, duplicate, malformed, owner-mismatched, or incompatible contracts
- Validate requests, decisions, and failures against both sides of the boundary
- Invoke providers with only the owner Module's scoped data, events, and options

Pass `{ optional: true }` to `acceptCapability` only when absence is a supported state. The legacy `exports` and `requires` declarations remain migration metadata and never grant cross-Module access.

For a contract with an `operation` discriminant, grant only the operations the consumer needs:

```typescript
acceptCapability(paymentIntentCapability, {
  operations: ["list"],
  optional: true,
})
```

The runtime rejects an invocation outside that allowlist before the provider runs.

## Client API

The client package provides React Query integration for consuming module endpoints.

### Setup

```tsx
import { ModuleClientProvider } from "@86d-app/core/client";
import cart from "@my-org/cart";
import products from "@my-org/products";

function App({ children }) {
  return (
    <ModuleClientProvider
      baseURL="/api"
      modules={[cart(), products()]}
      headers={() => ({
        Authorization: `Bearer ${getToken()}`,
      })}
    >
      {children}
    </ModuleClientProvider>
  );
}
```

### Using Hooks

```tsx
import { useModuleClient } from "@86d-app/core/client";

function ProductList() {
  const client = useModuleClient();

  // GET endpoints become queries
  const { data, isLoading } = client
    .module("products")
    .store["/products"]
    .useQuery({ category: "electronics" });

  // POST/PUT/DELETE endpoints become mutations
  const addToCart = client.module("cart").store["/cart"].useMutation({
    onSuccess: () => {
      // Invalidate related queries
      client.module("cart").store["/cart/get"].invalidate();
    },
  });

  if (isLoading) return <div>Loading...</div>;

  return (
    <ul>
      {data?.products.map((product) => (
        <li key={product.id}>
          {product.name}
          <button
            onClick={() =>
              addToCart.mutate({
                productId: product.id,
                quantity: 1,
                price: product.price,
              })
            }
          >
            Add to Cart
          </button>
        </li>
      ))}
    </ul>
  );
}
```

### Non-React Usage

```typescript
import { createModuleClient } from "@86d-app/core/client";
import cart from "@my-org/cart";

const client = createModuleClient([cart()], {
  baseURL: "https://api.example.com",
});

// Direct fetch (no React hooks)
const cartData = await client.module("cart").store["/cart/get"].fetch();
```

## API Reference

### Types

| Export | Description |
|--------|-------------|
| `Module` | Main module definition interface |
| `ModuleContext` | Runtime context passed to endpoints and init |
| `CapabilityDefinition` | Typed name, version, owner, request, decision, and failure contract |
| `CapabilityInvoker` | Consumer-scoped capability invocation interface |
| `defineCapability` | Define an immutable capability contract |
| `provideCapability` | Bind an owner handler to a capability contract |
| `acceptCapability` | Declare compatible versions, allowed operations, and optionality |
| `ModuleSchema` | Database schema definition type |
| `ModuleDataService` | Interface for scoped data access |
| `BaseAdapter` | Base interface for module adapters |

### Endpoint Utilities (re-exported from better-call)

| Export | Description |
|--------|-------------|
| `createEndpoint` | Create an HTTP endpoint |
| `createRouter` | Create a router from endpoints |
| `z` | Zod schema builder |
| `Endpoint` | Endpoint type |
| `EndpointContext` | Context passed to endpoint handlers |

### Client API

| Export | Description |
|--------|-------------|
| `ModuleClientProvider` | React provider component |
| `useModuleClient` | Hook to access the client |
| `createModuleClient` | Factory for non-React usage |
| `createQueryClient` | Create a QueryClient instance |
| `getQueryClient` | Get/create singleton QueryClient |

## Module Context

The `ModuleContext` provides access to:

```typescript
interface ModuleContext {
  storeId: string;                 // Current Store
  data: ModuleDataService;         // Current Module's data only
  capabilities: CapabilityInvoker; // Accepted cross-Module decisions
  controllers: ModuleControllers;  // Current Module's controllers only
  options: ModuleConfig;           // Current Module's options only
  modules: string[];               // Enabled Module IDs
  session?: Session | null;
  events?: ScopedEventEmitter;
}
```

## Best Practices

1. **Keep contracts pure** - Put shared capability schemas in `@86d-app/core`, without owner business logic
2. **Declare both sides** - Owners provide capabilities and consumers explicitly accept compatible versions
3. **Fail closed** - Treat unavailable or rejected authoritative decisions as bounded failures
4. **Scope data access** - Use `ctx.data` only for the current Module's entities
5. **Keep controllers local** - Use capabilities, never controller casts, across Module boundaries
6. **Keep modules focused** - Each Module should have a single authority and responsibility
