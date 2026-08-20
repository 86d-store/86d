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

# Wish Module

📚 **Documentation:** [86d.app/docs/modules/wish](https://86d.app/docs/modules/wish)

Integrates your 86d store with Wish marketplace for product listing, order management, and shipment tracking. Supports product review status tracking, tag-based organization, and shipping deadline management.

## Installation

```sh
npm install @86d-app/wish
```

## Usage

```ts
import wish from "@86d-app/wish";

const module = wish({
  accessToken: "your-access-token",
  merchantId: "your-merchant-id",
});
```

## Configuration

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `accessToken` | `string` | - | Wish API access token |
| `merchantId` | `string` | - | Wish merchant ID |

## Admin Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/wish/products` | List products with optional status, page, and limit filters |
| POST | `/admin/wish/products/create` | Create a new product listing |
| GET | `/admin/wish/products/:id` | Get a single product by ID |
| PUT | `/admin/wish/products/:id/update` | Update product fields |
| PUT | `/admin/wish/products/:id/disable` | Disable a product |
| GET | `/admin/wish/orders` | List orders with optional status, page, and limit filters |
| GET | `/admin/wish/orders/pending` | Get pending shipments (approved orders sorted oldest-first) |
| PUT | `/admin/wish/orders/:id/ship` | Ship an order with tracking number and carrier |
| GET | `/admin/wish/stats` | Get channel statistics |

## Store Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/wish/webhooks` | Receive Wish webhook events |

## Controller API

```ts
interface WishController extends ModuleController {
  createProduct(params: { localProductId: string; title: string; price: number; shippingPrice: number; ... }): Promise<WishProduct>;
  updateProduct(id: string, params: Partial<WishProduct>): Promise<WishProduct | null>;
  disableProduct(id: string): Promise<WishProduct | null>;
  getProduct(id: string): Promise<WishProduct | null>;
  getProductByLocalId(productId: string): Promise<WishProduct | null>;
  listProducts(params?: { status?; take?; skip? }): Promise<WishProduct[]>;
  receiveOrder(params: { wishOrderId: string; items: unknown[]; ... }): Promise<WishOrder>;
  getOrder(id: string): Promise<WishOrder | null>;
  shipOrder(id: string, trackingNumber: string, carrier: string): Promise<WishOrder | null>;
  listOrders(params?: { status?; take?; skip? }): Promise<WishOrder[]>;
  getChannelStats(): Promise<ChannelStats>;
  getPendingShipments(): Promise<WishOrder[]>;
}
```

## Types

- **WishProduct** -- Product listing with shipping price, tags, parent SKU grouping, and Wish review status tracking
- **WishOrder** -- Order with Wish-specific fee breakdown (orderTotal, shippingTotal, wishFee) and shipping deadlines (shipByDate, deliverByDate)
- **ChannelStats** -- Aggregated product and order stats including pending shipment count

## Notes

- Product statuses: `active`, `disabled`, `pending-review`, `rejected`
- Order statuses: `pending`, `approved`, `shipped`, `delivered`, `refunded`, `cancelled`
- Products include `shippingPrice` as a required field (Wish requires separate shipping pricing)
- `getPendingShipments()` returns `approved` orders sorted oldest-first for priority fulfillment
- Admin page appears under the **Sales** group with the **Star** icon
- Admin and store endpoints are fully wired via `createAdminEndpoint` and `createStoreEndpoint`
