<p align="center">
  <a href="https://86d.app">
    <img src="https://86d.app/logo" height="96" alt="86d" />
  </a>
</p>

<p align="center">Dynamic Commerce</p>

<p align="center">
  <a href="https://x.com/86d_app"><strong>X</strong></a> ·
  <a href="https://www.linkedin.com/company/86d"><strong>LinkedIn</strong></a>
</p>
<br/>

> [!WARNING]
> This project is under active development and is not ready for production use.

# Pinterest Shop Module

📚 **Documentation:** [86d.app/docs/modules/pinterest-shop](https://86d.app/docs/modules/pinterest-shop)

Integrates your 86d store with Pinterest for catalog management, shopping pin creation, and pin performance analytics. Manage product catalogs synced to Pinterest and track engagement metrics like impressions, saves, and clicks.

## Installation

```sh
npm install @86d-app/pinterest-shop
```

## Usage

```ts
import pinterestShop from "@86d-app/pinterest-shop";

const module = pinterestShop({
  accessToken: "your-access-token",
  adAccountId: "your-ad-account-id",
  catalogId: "your-catalog-id",
});
```

## Configuration

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `accessToken` | `string` | - | Pinterest API access token |
| `adAccountId` | `string` | - | Pinterest ad account ID |
| `catalogId` | `string` | - | Pinterest catalog ID |

## Admin Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/pinterest-shop/items` | List catalog items with optional status, availability, page, and limit filters |
| POST | `/admin/pinterest-shop/items/create` | Create a new catalog item |
| GET | `/admin/pinterest-shop/items/:id` | Get a single catalog item by ID |
| PUT | `/admin/pinterest-shop/items/:id/update` | Update catalog item fields |
| DELETE | `/admin/pinterest-shop/items/:id/delete` | Delete a catalog item |
| POST | `/admin/pinterest-shop/sync` | Trigger a catalog sync |
| GET | `/admin/pinterest-shop/syncs` | List catalog sync history |
| GET | `/admin/pinterest-shop/pins` | List shopping pins with optional catalog item filter |
| POST | `/admin/pinterest-shop/pins/create` | Create a new shopping pin |
| GET | `/admin/pinterest-shop/stats` | Get channel statistics |

## Store Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/pinterest-shop/webhooks` | Receive Pinterest webhook events |

## Controller API

```ts
interface PinterestShopController extends ModuleController {
  createCatalogItem(params: { localProductId: string; title: string; link: string; imageUrl: string; price: number; ... }): Promise<CatalogItem>;
  updateCatalogItem(id: string, params: Partial<CatalogItem>): Promise<CatalogItem | null>;
  deleteCatalogItem(id: string): Promise<boolean>;
  getCatalogItem(id: string): Promise<CatalogItem | null>;
  getCatalogItemByProduct(productId: string): Promise<CatalogItem | null>;
  listCatalogItems(params?: { status?; availability?; take?; skip? }): Promise<CatalogItem[]>;
  syncCatalog(): Promise<CatalogSync>;
  getLastSync(): Promise<CatalogSync | null>;
  listSyncs(params?: { status?; take?; skip? }): Promise<CatalogSync[]>;
  createPin(params: { catalogItemId: string; title: string; link: string; imageUrl: string; ... }): Promise<ShoppingPin>;
  getPin(id: string): Promise<ShoppingPin | null>;
  listPins(params?: { catalogItemId?; take?; skip? }): Promise<ShoppingPin[]>;
  getPinAnalytics(id: string): Promise<PinAnalytics | null>;
  getChannelStats(): Promise<ChannelStats>;
}
```

## Types

- **CatalogItem** -- Product entry in the Pinterest catalog with status, pricing, availability, and optional Google product category
- **ShoppingPin** -- A shopping pin linked to a catalog item, tracks impressions, saves, and clicks
- **CatalogSync** -- Catalog sync job with progress tracking (total, synced, failed items)
- **PinAnalytics** -- Computed analytics for a pin including click rate and save rate

## Notes

- Catalog item statuses: `active`, `inactive`, `disapproved`
- Availability values: `in-stock`, `out-of-stock`, `preorder`
- Sync statuses: `pending`, `syncing`, `synced`, `failed`
- Pin analytics rates are computed as ratios to impressions (0 if no impressions)
- Admin page appears under the **Sales** group with the **Pin** icon
- Admin and store endpoints are fully wired via `createAdminEndpoint` and `createStoreEndpoint`
