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

# Wishlist Module

📚 **Documentation:** [86d.app/docs/modules/wishlist](https://86d.app/docs/modules/wishlist)

Customer wishlist and favorites module for 86d commerce platform. Supports per-customer wishlists with sharing via shareable links, bulk operations, and configurable item limits.

## Installation

```sh
npm install @86d-app/wishlist
```

## Usage

```ts
import wishlist from "@86d-app/wishlist";

const module = wishlist({
  maxItems: "50",
});
```

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `maxItems` | `string` | — | Maximum number of items per customer wishlist. Returns 422 when exceeded. |

## Store Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/wishlist` | List current customer's wishlist items (paginated) |
| `POST` | `/wishlist/add` | Add an item to the wishlist |
| `DELETE` | `/wishlist/remove/:id` | Remove an item by ID |
| `POST` | `/wishlist/bulk-remove` | Remove multiple items by ID array |
| `GET` | `/wishlist/check/:productId` | Check if a product is in the wishlist |
| `POST` | `/wishlist/share` | Create a shareable link for the wishlist |
| `GET` | `/wishlist/shares` | List active share tokens |
| `POST` | `/wishlist/share/:id/revoke` | Revoke a share token |
| `GET` | `/wishlist/shared/:token` | View a shared wishlist (public, no auth) |

## Admin Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/admin/wishlist` | List all wishlist items (filterable by customer or product) |
| `GET` | `/admin/wishlist/summary` | Wishlist analytics (total items, top products) |
| `DELETE` | `/admin/wishlist/:id/delete` | Delete a wishlist item |

## Controller API

```ts
interface WishlistController {
  addItem(params: {
    customerId: string;
    productId: string;
    productName: string;
    productImage?: string;
    note?: string;
  }): Promise<WishlistItem>;

  removeItem(id: string): Promise<boolean>;
  removeByProduct(customerId: string, productId: string): Promise<boolean>;
  bulkRemove(customerId: string, itemIds: string[]): Promise<number>;
  getItem(id: string): Promise<WishlistItem | null>;
  isInWishlist(customerId: string, productId: string): Promise<boolean>;
  listByCustomer(customerId: string, params?: {
    take?: number;
    skip?: number;
  }): Promise<WishlistItem[]>;
  listAll(params?: {
    customerId?: string;
    productId?: string;
    take?: number;
    skip?: number;
  }): Promise<{ items: WishlistItem[]; total: number }>;
  countByCustomer(customerId: string): Promise<number>;
  getSummary(): Promise<WishlistSummary>;
  createShareToken(customerId: string, expiresAt?: Date): Promise<WishlistShare>;
  revokeShareToken(customerId: string, tokenId: string): Promise<boolean>;
  getShareTokens(customerId: string): Promise<WishlistShare[]>;
  getSharedWishlist(token: string): Promise<WishlistItem[] | null>;
}
```

## Types

```ts
interface WishlistItem {
  id: string;
  customerId: string;
  productId: string;
  productName: string;
  productImage?: string;
  note?: string;
  addedAt: Date;
}

interface WishlistShare {
  id: string;
  customerId: string;
  token: string;
  active: boolean;
  createdAt: Date;
  expiresAt?: Date;
}

interface WishlistSummary {
  totalItems: number;
  topProducts: Array<{
    productId: string;
    productName: string;
    count: number;
  }>;
}
```

## Events

| Event | Payload | Description |
|---|---|---|
| `wishlist.itemAdded` | `{ customerId, productId, productName, itemId }` | Fired when an item is added |
| `wishlist.itemRemoved` | `{ customerId, productId, productName, itemId }` | Fired when an item is removed |
| `wishlist.shared` | `{ customerId, shareId, token }` | Fired when a share link is created |

## Store Components

### WishlistButton

Toggle button for adding/removing a product from the customer's wishlist. Fetches its own data to check current wishlist status.

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `productId` | `string` | — | Product ID (required) |
| `productName` | `string` | — | Product name for the wishlist entry (required) |
| `productImage` | `string` | — | Product image URL |
| `customerId` | `string` | — | Customer ID. If omitted, the button appears disabled |

#### Usage in MDX

```mdx
<WishlistButton productId={product.id} productName={product.name} />

<WishlistButton
  productId={product.id}
  productName={product.name}
  productImage={product.images[0]}
  customerId={customerId}
/>
```

Typically placed on product cards or product detail pages alongside the "Add to Cart" button.

### WishlistPage

Full wishlist page displaying all saved items with remove functionality. Fetches its own data.

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `customerId` | `string` | — | Customer ID. Shows sign-in prompt if omitted |

#### Usage in MDX

```mdx
<WishlistPage customerId={customerId} />
```

Typically placed on a dedicated `/wishlist` page in the store template.

### HeartIcon

Simple heart icon with filled/unfilled states. Used internally by WishlistButton.

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `filled` | `boolean` | — | Whether the heart is filled (required) |
| `large` | `boolean` | `false` | Use larger size |

#### Usage in MDX

```mdx
<HeartIcon filled={false} />

<HeartIcon filled={true} large={true} />
```

## Notes

- `addItem` is idempotent: adding the same product twice returns the existing item
- `maxItems` is enforced per-customer, not globally
- Share tokens are opaque 32-character hex strings
- `getSharedWishlist` is the only public endpoint (no auth) — access controlled by opaque token
- `bulkRemove` only removes items owned by the requesting customer (ownership checked per item)
- Requires `cart` module optionally for future move-to-cart integration
