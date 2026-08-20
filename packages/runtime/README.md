# @86d-app/runtime

Runtime utilities for hosting and initializing modules in the 86d module system. This package is used by the host application to bootstrap modules, manage module lifecycles, and provide scoped data access.

> **Note**: This package is for internal use by the host application. Module authors should use `@86d-app/core`.

## Features

- **Module registry** - Register, boot, and manage module lifecycles (`ModuleRegistry`)
- **Universal data service** - Scoped per-module data access (`UniversalDataService`)
- **Adapter registry** - Manage module data adapters
- **Dependency validation** - Automatically validates module `requires` dependencies

## Usage

### Module Registry

The `ModuleRegistry` is the primary way to bootstrap and manage modules at runtime:

```typescript
import { ModuleRegistry } from "@86d-app/runtime/registry";
import cart from "@86d-app/cart";
import products from "@86d-app/products";

const registry = new ModuleRegistry();
registry.register(products());
registry.register(cart());

// Boot all modules (validates dependencies, creates data services)
await registry.boot({ db, storeId: "store_123" });

// Access module request context
const ctx = await registry.getRequestContext({ session });
```

### Adapter Registry

Manage module adapters for data operations:

```typescript
import { AdapterRegistry, createNoOpAdapter } from "@86d-app/runtime/adapters";

const registry = new AdapterRegistry();

// Register adapters
registry.register("cart", cartAdapter);
registry.register("products", productsAdapter);

// Access adapters
const adapter = registry.get("cart");

// For development/testing - throws when methods are called
const devAdapter = createNoOpAdapter("cart");
```

## API Reference

### Registry

| Export | Description |
|--------|-------------|
| `ModuleRegistry` | Register, boot, and manage module lifecycles |

### Adapter Utilities

| Export | Description |
|--------|-------------|
| `AdapterRegistry` | Class for managing adapters |
| `createNoOpAdapter` | Create a no-op adapter for development |

### Data Access

| Export | Description |
|--------|-------------|
| `UniversalDataService` | Scoped data access implementation |
| `DataServiceConfig` | Configuration for data service |

## Module Initialization Order

Modules are initialized in registration order. The registry:

1. Iterates through modules in order
2. For each module, validates `requires` dependencies
3. Creates a scoped `UniversalDataService` for data access
4. Calls the module's `init` function with current context
5. Merges returned controllers into the shared controller map
6. Marks the module as initialized

## Error Handling

The runtime provides clear error messages for common issues:

```
Module "checkout" requires "cart" but it was not initialized.
Ensure "cart" appears before "checkout" in your modules array.
```
