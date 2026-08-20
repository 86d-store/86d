

# @86d-app/gift-wrapping

📚 **Documentation:** [86d.app/docs/modules/gift-wrapping](https://86d.app/docs/modules/gift-wrapping)

Gift wrapping module for 86d commerce platform. Allows store owners to create wrapping options with custom pricing, and customers to add gift wrapping with personalized messages to individual order items during checkout.

## Installation

Add to your store's module configuration:

```ts
import giftWrapping from "@86d-app/gift-wrapping";

export const modules = [
  giftWrapping({
    maxMessageLength: 500, // optional
  }),
];
```

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `maxMessageLength` | `number` | `500` | Maximum gift message length in characters |

## Store endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/gift-wrapping/options` | List active wrapping options |
| `POST` | `/gift-wrapping/select` | Add gift wrapping to an order item |
| `POST` | `/gift-wrapping/remove` | Remove gift wrapping from an order item |
| `GET` | `/gift-wrapping/order/:orderId` | Get all wrapping selections + total for an order |
| `GET` | `/gift-wrapping/item/:orderItemId` | Get wrapping selection for a specific item |

## Admin endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/admin/gift-wrapping` | List all wrapping options (filterable by active) |
| `POST` | `/admin/gift-wrapping/create` | Create a wrapping option |
| `GET` | `/admin/gift-wrapping/summary` | Dashboard summary stats |
| `GET` | `/admin/gift-wrapping/:id` | Get wrapping option detail |
| `POST` | `/admin/gift-wrapping/:id/update` | Update a wrapping option |
| `POST` | `/admin/gift-wrapping/:id/delete` | Delete a wrapping option |
| `GET` | `/admin/gift-wrapping/order/:orderId` | View wrapping selections for an order |

## Controller API

```ts
interface GiftWrappingController {
  // Wrap option CRUD
  createOption(params: CreateWrapOptionParams): Promise<WrapOption>;
  updateOption(id: string, params: UpdateWrapOptionParams): Promise<WrapOption | null>;
  getOption(id: string): Promise<WrapOption | null>;
  listOptions(params?: ListOptionsParams): Promise<WrapOption[]>;
  deleteOption(id: string): Promise<boolean>;

  // Wrap selections
  selectWrapping(params: SelectWrappingParams): Promise<WrapSelection>;
  removeSelection(id: string): Promise<boolean>;
  getSelection(id: string): Promise<WrapSelection | null>;
  getOrderSelections(orderId: string): Promise<WrapSelection[]>;
  getOrderWrappingTotal(orderId: string): Promise<OrderWrappingTotal>;
  getItemSelection(orderItemId: string): Promise<WrapSelection | null>;

  // Analytics
  getWrapSummary(): Promise<WrapSummary>;
}
```

## Types

### WrapOption

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique ID |
| `name` | `string` | Display name |
| `description` | `string?` | Optional description |
| `priceInCents` | `number` | Price in cents (0 = free) |
| `imageUrl` | `string?` | Preview image URL |
| `active` | `boolean` | Whether available for selection |
| `sortOrder` | `number` | Display order |

### WrapSelection

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique ID |
| `orderId` | `string` | Associated order |
| `orderItemId` | `string` | Order line item |
| `wrapOptionId` | `string` | Chosen wrapping option |
| `wrapOptionName` | `string` | Option name (snapshotted) |
| `priceInCents` | `number` | Price charged (snapshotted) |
| `recipientName` | `string?` | Name on the gift tag |
| `giftMessage` | `string?` | Custom gift message |
| `customerId` | `string?` | Customer who selected wrapping |

## Notes

- Each order item can have at most one wrapping selection
- Prices are snapshotted when wrapping is selected — later price changes don't affect existing selections
- Free wrapping options are supported (set `priceInCents: 0`)
- All prices are in cents to avoid floating-point issues
- Use `getOrderWrappingTotal()` to add wrapping costs to order totals at checkout
