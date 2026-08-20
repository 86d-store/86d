# Wish Module

Integrates with Wish marketplace for product listing, order management, and shipment tracking.

## Structure

```
src/
  index.ts          Factory: wish(options?) => Module + admin nav (Sales > Wish)
  schema.ts         Zod models: wishProduct, wishOrder
  service.ts        WishController interface
  service-impl.ts   WishController implementation via ModuleDataService
  store/endpoints/  webhooks.ts
  admin/endpoints/  create-product, get-product, list-products, update-product, disable-product, list-orders, ship-order, pending-shipments, stats
  admin/components/ index.tsx, wish-admin.tsx, wish-admin.mdx
  __tests__/        (none)
```

## Options

```ts
interface WishOptions extends ModuleConfig {
  accessToken?: string;  // Wish API access token
  merchantId?: string;   // Wish merchant ID
}
```

## Data Models

- **WishProduct** -- id, localProductId, wishProductId, title, status (active|disabled|pending-review|rejected), price, shippingPrice, quantity, parentSku, tags[], lastSyncedAt, reviewStatus, error
- **WishOrder** -- id, wishOrderId, status (pending|approved|shipped|delivered|refunded|cancelled), items, orderTotal, shippingTotal, wishFee, customerName, shippingAddress, trackingNumber, carrier, shipByDate, deliverByDate
- **ChannelStats** -- totalProducts, activeProducts, totalOrders, totalRevenue, pendingShipments, disabledProducts

## Patterns

- Controller key: `wish`
- Events emitted: `wish.product.synced`, `wish.product.disabled`, `wish.order.received`, `wish.order.shipped`, `wish.refund.created`
- Exports read fields: `wishProductTitle`, `wishProductStatus`, `wishProductPrice`, `wishProductId`
- `disableProduct()` sets status to `disabled`
- `getPendingShipments()` returns orders with `approved` status ordered by creation date (oldest first)
- pendingShipments stat counts orders with `pending` or `approved` status
### Admin Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/wish/products` | List products with optional status filter |
| POST | `/admin/wish/products/create` | Create a new product |
| GET | `/admin/wish/products/:id` | Get a single product by ID |
| PUT | `/admin/wish/products/:id/update` | Update product fields |
| PUT | `/admin/wish/products/:id/disable` | Disable a product |
| GET | `/admin/wish/orders` | List orders with optional status filter |
| GET | `/admin/wish/orders/pending` | Get pending shipments (approved orders, oldest first) |
| PUT | `/admin/wish/orders/:id/ship` | Ship an order (trackingNumber, carrier) |
| GET | `/admin/wish/stats` | Get channel stats |

### Store Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/wish/webhooks` | Receive Wish webhook events |
