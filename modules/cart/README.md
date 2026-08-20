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

# Cart Module

📚 **Documentation:** [86d.app/docs/modules/cart](https://86d.app/docs/modules/cart)

Shopping cart module for guest and authenticated customers. Supports adding, updating, and removing items with configurable expiration and per-cart item limits.

## Installation

```sh
npm install @86d-app/cart
```

## Usage

```ts
import cart from "@86d-app/cart";

const module = cart({
  guestCartExpiration: 604800000, // 7 days in ms
  maxItemsPerCart: 100,
});
```

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `guestCartExpiration` | `number` | `604800000` | Guest cart TTL in milliseconds (7 days) |
| `maxItemsPerCart` | `number` | `100` | Maximum number of distinct items per cart |

## Store Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/cart` | Add an item to the cart |
| `GET` | `/cart/get` | Get the current cart with items and totals |
| `PATCH` | `/cart/items/:id/update` | Update quantity of a cart item |
| `DELETE` | `/cart/items/:id/remove` | Remove a single item from the cart |
| `POST` | `/cart/clear` | Remove all items from the cart |

All store endpoints return a consistent shape:

```ts
{
  cart: Cart;
  items: CartItem[];
  itemCount: number;
  subtotal: number;
}
```

## Admin Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/admin/carts` | List all carts (paginated) |
| `GET` | `/admin/carts/:id` | Get a cart with its items |
| `DELETE` | `/admin/carts/:id/delete` | Delete a cart |

## Controller API

The `CartController` interface is exported for use in inter-module contracts (e.g. checkout referencing the cart).

```ts
interface CartController {
  /** Get an existing cart or create one for the given customer/guest */
  getOrCreateCart(params: {
    customerId?: string;
    guestId?: string;
  }): Promise<Cart>;

  /** Retrieve all items in a cart */
  getCartItems(cartId: string): Promise<CartItem[]>;

  /** Calculate the total price of all items in a cart */
  getCartTotal(cartId: string): Promise<number>;

  /** Check whether a product exists in any active cart */
  isProductInActiveCart(productId: string): Promise<boolean>;

  /** Add a product (or variant) to a cart */
  addItem(params: {
    cartId: string;
    productId: string;
    variantId?: string;
    quantity: number;
    price: number;
  }): Promise<CartItem>;

  /** Change the quantity of an existing cart item */
  updateItem(itemId: string, quantity: number): Promise<CartItem>;

  /** Remove a single item from a cart */
  removeItem(itemId: string): Promise<void>;

  /** Remove all items from a cart */
  clearCart(cartId: string): Promise<void>;
}
```

## Types

```ts
interface Cart {
  id: string;
  customerId?: string;
  guestId?: string;
  status: "active" | "abandoned" | "converted";
  expiresAt: Date;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

interface CartItem {
  id: string;
  cartId: string;
  productId: string;
  variantId?: string;
  quantity: number;
  /** Price snapshot at time of adding to cart (in cents) */
  price: number;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}
```

## Store Components

### Cart

Shopping cart drawer. Slides in from the right when opened. Displays cart items, subtotal, and checkout link.

#### Props

None. The cart fetches its own data via the module client.

#### Usage in MDX

```mdx
<Cart />
```

Typically placed in the main layout (e.g. `templates/brisa/layout.mdx`) so it's available on every page.

### CartButton

Button that opens the cart drawer. Shows a badge with item count when the cart has items.

#### Props

None.

#### Usage in MDX

```mdx
<CartButton />
```

Typically placed in the navbar actions area:

```mdx
<StoreNavbar actions={<CartButton />} ... />
```

## Notes

- Cart item IDs are deterministic: `${cartId}_${productId}[_${variantId}]`. Adding the same product twice updates its quantity.
- Guest carts use a `guestId`; authenticated carts use a `customerId`. Both can coexist.
- The storage adapter is swappable — replace the default in-memory adapter with any persistence layer.
