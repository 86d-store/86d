

# @86d-app/gift-registry

📚 **Documentation:** [86d.app/docs/modules/gift-registry](https://86d.app/docs/modules/gift-registry)

Gift registry module for 86d commerce platform. Allows customers to create and share gift registries for weddings, baby showers, birthdays, housewarmings, holidays, and more. Visitors can browse registries, view items, and purchase gifts.

## Installation

Add to your store's module configuration:

```ts
import giftRegistry from "@86d-app/gift-registry";

export const modules = [
  giftRegistry({
    maxRegistriesPerCustomer: 5, // optional
  }),
];
```

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `maxRegistriesPerCustomer` | `number` | `0` | Maximum registries per customer (0 = unlimited) |

## Store endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/gift-registry` | No | Browse public registries (filterable by type) |
| `GET` | `/gift-registry/:slug` | No | View a registry and its items |
| `POST` | `/gift-registry/create` | Yes | Create a new registry |
| `POST` | `/gift-registry/update` | Yes | Update own registry |
| `POST` | `/gift-registry/items/add` | Yes | Add item to own registry |
| `POST` | `/gift-registry/items/remove` | Yes | Remove item from own registry |
| `POST` | `/gift-registry/purchase` | No* | Purchase an item from a registry |
| `GET` | `/gift-registry/mine` | Yes | List own registries |

*Guest purchases are allowed (purchaser ID is optional).

## Admin endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/admin/gift-registry` | List all registries (filterable) |
| `GET` | `/admin/gift-registry/summary` | Dashboard summary stats |
| `GET` | `/admin/gift-registry/:id` | Registry detail with items + purchases |
| `POST` | `/admin/gift-registry/:id/delete` | Delete a registry |
| `POST` | `/admin/gift-registry/:id/archive` | Archive a registry |
| `GET` | `/admin/gift-registry/:id/items` | List registry items |
| `GET` | `/admin/gift-registry/:id/purchases` | List registry purchases |

## Controller API

```ts
interface GiftRegistryController {
  // Registry CRUD
  createRegistry(params: CreateRegistryParams): Promise<Registry>;
  updateRegistry(id: string, params: UpdateRegistryParams): Promise<Registry | null>;
  getRegistry(id: string): Promise<Registry | null>;
  getRegistryBySlug(slug: string): Promise<Registry | null>;
  listRegistries(params?: ListRegistriesParams): Promise<Registry[]>;
  deleteRegistry(id: string): Promise<boolean>;
  archiveRegistry(id: string): Promise<Registry | null>;

  // Items
  addItem(params: AddItemParams): Promise<RegistryItem>;
  updateItem(id: string, params: UpdateItemParams): Promise<RegistryItem | null>;
  removeItem(id: string): Promise<boolean>;
  listItems(registryId: string, params?): Promise<RegistryItem[]>;
  getItem(id: string): Promise<RegistryItem | null>;

  // Purchases
  purchaseItem(params: PurchaseItemParams): Promise<RegistryPurchase>;
  listPurchases(registryId: string, params?): Promise<RegistryPurchase[]>;
  getPurchasesByItem(registryItemId: string): Promise<RegistryPurchase[]>;

  // Customer
  getCustomerRegistries(customerId: string): Promise<Registry[]>;

  // Analytics
  getRegistrySummary(): Promise<RegistrySummary>;
}
```

## Types

### Registry

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique ID |
| `customerId` | `string` | Owner customer ID |
| `customerName` | `string` | Owner display name |
| `title` | `string` | Registry title |
| `description` | `string?` | Optional description |
| `type` | `RegistryType` | wedding, baby, birthday, housewarming, holiday, other |
| `slug` | `string` | URL-safe shareable identifier |
| `visibility` | `RegistryVisibility` | public, unlisted, private |
| `status` | `RegistryStatus` | active, completed, archived |
| `eventDate` | `Date?` | Event date |
| `coverImageUrl` | `string?` | Cover image |
| `thankYouMessage` | `string?` | Message shown after purchase |
| `itemCount` | `number` | Total items on registry |
| `purchasedCount` | `number` | Fully purchased items |

### RegistryItem

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique ID |
| `registryId` | `string` | Parent registry |
| `productId` | `string` | Product reference |
| `productName` | `string` | Product display name |
| `variantId` | `string?` | Variant reference |
| `priceInCents` | `number` | Unit price in cents |
| `quantityDesired` | `number` | How many wanted |
| `quantityReceived` | `number` | How many purchased |
| `priority` | `ItemPriority` | must_have, nice_to_have, dream |
| `note` | `string?` | Personal note from registrant |

### RegistryPurchase

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique ID |
| `registryId` | `string` | Registry reference |
| `registryItemId` | `string` | Item reference |
| `purchaserId` | `string?` | Buyer customer ID (null for guests) |
| `purchaserName` | `string` | Buyer display name |
| `quantity` | `number` | Quantity purchased |
| `amountInCents` | `number` | Total paid |
| `giftMessage` | `string?` | Gift message |
| `isAnonymous` | `boolean` | Hide purchaser from registrant |

## Notes

- Registries auto-complete when all items reach their desired quantity
- Private registries are only visible to their owner
- Slugs are auto-generated with a UUID suffix for uniqueness, or can be specified manually
- All prices are in cents to avoid floating-point issues
